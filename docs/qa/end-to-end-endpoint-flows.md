# Certificación funcional por secciones: alta, operación diaria y premios

## Convenciones

- `Público`: no requiere JWT.
- `Propietario`: creador de la empresa y administrador del tenant.
- `Billing`: propietario o miembro con `puede_gestionar_facturacion=true`.
- `Finanzas AlphaBy`: perfil presente y activo en `platform_admins` con permiso de revisión.
- `Vendedor`: miembro activo con perfil de vendedor activo.
- Todas las rutas privadas resuelven el tenant desde el JWT y, si hace falta, `tenant` o `x-tenant-id`.
- Un tenant `PENDIENTE_PAGO` solo puede autenticarse y entrar a facturación. Las rutas operativas responden `403`.

## 1. Disponibilidad del servicio

1. `GET /` confirma el contrato base.
2. `GET /health` confirma que el proceso está vivo.
3. `GET /health/ready` comprueba PostgreSQL, Supabase y Redis antes de habilitar tráfico.

Resultado esperado: las tres respuestas usan el envelope estándar; readiness debe ser `ok` para iniciar una jornada.

## 2. Alta de empresa y primer pago

1. `GET /billing/plans?channel=BANK_TRANSFER` devuelve precios activos en NIO/USD.
2. `POST /billing/signup` crea Auth user, perfil, tenant, roles, permisos, propietario, cuenta de facturación y suscripción incompleta. Estado inicial: `PENDIENTE_PAGO`.
3. El propietario verifica su correo en Supabase.
4. `POST /auth/login` permite iniciar sesión con alcance restringido de facturación.
5. Una llamada operativa, por ejemplo `GET /draws/configurations`, debe responder `403` mientras no exista pago aprobado.
6. `GET /billing/portal` muestra tenant, plan, factura, cuentas bancarias de la moneda correcta y declaraciones previas.
7. `POST /billing/portal/invoices/initial` crea o reutiliza el primer cobro.
8. `POST /billing/portal/transfers` exige factura abierta, cuenta bancaria de la misma moneda y monto exacto. No acepta pagos parciales ni conversión.
9. `POST /billing/portal/transfers/:id/evidence` acepta PDF/JPEG/PNG real de hasta 10 MB; valida firma binaria, no solo MIME.
10. `GET /billing/admin/transfers?status=EN_REVISION` coloca la declaración en la cola privada de AlphaBy.
11. `POST /billing/admin/transfers/:id/review` exige referencia bancaria conciliada para aprobar. La aprobación es atómica: revisión inmutable, pago, factura pagada, suscripción activa y tenant `ACTIVO`.
12. Una nueva llamada a `GET /draws/configurations` debe responder `200`.

Alternativas y procesos internos:

- `POST /billing/portal/paypal/checkout`: opcional; responde `403` cuando PayPal está deshabilitado.
- `POST /billing/webhooks/paypal`: solo procesa webhooks con firma válida; un evento sin firma responde `401`.
- `POST /billing/internal/cycle`: requiere `x-billing-worker-secret`; genera renovaciones y aplica gracia/morosidad.
- `POST /billing/development/complete`: debe permanecer deshabilitado fuera de una configuración de desarrollo explícita.

## 3. Autenticación y sesiones

1. `POST /auth/login` autentica en Supabase y resuelve una sola membresía por slug/UUID.
2. `GET /auth/me` devuelve rol, permisos, tenant y vendedor asociado.
3. `POST /auth/refresh` renueva la sesión y vuelve a resolver el tenant; no confía ciegamente en el contexto anterior.
4. `POST /auth/logout` revoca la sesión de refresh.
5. `POST /auth/password/reset/request` es resistente a enumeración: siempre acepta una solicitud bien formada.
6. `POST /auth/password/reset/confirm` exige código vigente, contraseña y confirmación iguales.
7. `POST /auth/password/reset/admin` requiere ADMIN y `usuarios.update`, revoca sesiones y nunca audita contraseñas/códigos.

Negativos obligatorios: credenciales inválidas `401`, JWT ausente `401`, tenant ambiguo sin selector, usuario/membresía inactivos y vendedor de empresa suspendida.

## 4. Vendedores e invitaciones

1. `GET /identity-access/sellers` lista únicamente vendedores del tenant actual.
2. `GET /identity-access/sellers/invitations` permite filtrar invitaciones del tenant.
3. `POST /identity-access/sellers/invitations` crea perfil inactivo, membresía `INVITADO`, vendedor inactivo y credencial de un solo uso.
4. `POST /identity-access/sellers/access-code/resend` revoca el código anterior y emite uno nuevo.
5. `POST /identity-access/sellers/access-code/confirm` consume una sola vez el código/token, crea el Auth user confirmado y activa, en una misma transacción, perfil, membresía y vendedor.
6. `POST /auth/login` del vendedor debe devolver su `seller.id` y permisos de vendedor.
7. `PATCH /identity-access/sellers/invitations/:invitationId/revoke` invalida una invitación pendiente.
8. `PATCH /identity-access/sellers/:sellerId/soft-delete` suspende únicamente la membresía y el vendedor del tenant, sin desactivar la identidad global ni borrar historial.
9. `DELETE /identity-access/sellers/:sellerId` elimina los datos operativos removibles del tenant y deja una membresía revocada como tombstone. Rechaza la operación si existen ventas históricas; en ese caso se exige baja reversible.

La identidad de Supabase no se elimina desde una empresa: un mismo perfil puede
pertenecer a otros tenants. Auditoría e identidad global se preservan siempre.

Seguridad: un vendedor puede operar sus ventas, pero no administrar sorteos, roles, otros usuarios, facturación AlphaBy ni pagos de premios.

## 5. Roles, permisos y parámetros

1. `GET /parameters/access/modules` carga el catálogo de módulos.
2. `GET /parameters/access/roles` carga la matriz completa del tenant.
3. `GET /parameters/access/roles/:roleId` consulta un rol del mismo tenant.
4. `POST /parameters/access/roles` crea un rol del tenant.
5. `PUT /parameters/access/roles/:roleId/permissions` reemplaza la matriz de forma idempotente.
6. `PATCH /parameters/access/users/:userId/role` reasigna un miembro del tenant sin aceptar roles cruzados.
7. `GET /parameters`, `GET /parameters/:key` y `PUT /parameters/:key` administran configuración operacional aislada por tenant.

Después de cada cambio de RBAC se debe renovar sesión o volver a consultar identidad antes de asumir permisos nuevos.

## 6. Configuración de sorteos y apertura de jornada

1. `POST /draws/configurations` crea el horario/reglas del sorteo.
2. `GET /draws/configurations` y `GET /draws/configurations/:id` verifican la configuración.
3. `PATCH /draws/configurations/:id` modifica únicamente campos permitidos.
4. `POST /draws/shifts` abre el turno del día; la combinación configuración/fecha no debe duplicarse.
5. `POST /draws/shifts/auto-generate` crea los turnos correspondientes a la fecha según reglas activas.
6. `GET /draws/shifts` lista la jornada y `GET /draws/shifts/active` alimenta la pantalla de venta.
7. `PATCH /draws/shifts/:id/block`, `/reopen` y `/close` aplican la máquina de estados del turno.

Eliminación controlada:

- `GET /draws/configurations/:id/delete-impact` debe consultarse primero.
- `PATCH /draws/configurations/:id/soft-delete` conserva historial.
- `DELETE /draws/configurations/:id` exige contraseña administrativa, frase de confirmación e inexistencia de impacto incompatible.

## 7. Límites y números bloqueados

1. `POST /number-limits` define topes globales/por vendedor y opcionalmente por sorteo.
2. `GET /number-limits` y `GET /number-limits/:id` verifican el límite efectivo.
3. `PATCH /number-limits/:id` cambia el monto sin crear rangos solapados.
4. `PATCH /number-limits/:id/expire` cierra su vigencia.
5. `POST /blocked-numbers` bloquea uno o varios números por turno/fecha.
6. `GET /blocked-numbers` y `GET /blocked-numbers/:id` verifican el bloqueo.
7. `DELETE /blocked-numbers/:id` lo retira.

Prueba negativa: `POST /sales` con un número bloqueado o que exceda el límite debe responder `422` y no crear venta parcial.

## 8. Ventas durante el día

1. `POST /sales` registra una venta multi-número atómica para un turno abierto.
2. `GET /sales` lista ventas según rol: el vendedor solo ve el alcance permitido; el administrador puede filtrar vendedor/turno.
3. `GET /sales/:saleId` devuelve detalle y estado.
4. `GET /sales/settings/void-policy` consulta la ventana de anulación.
5. `PATCH /sales/settings/void-policy` cambia la ventana como ADMIN.
6. `PATCH /sales/:saleId/void` exige motivo y una venta anulable dentro de la política.
7. `GET /sales-matrix` consolida 00-99 y debe cuadrar exactamente con ventas activas; ventas anuladas no suman.

Pruebas de dinero: decimales deben mantener precisión, el total de la venta debe igualar sus detalles y la matriz debe igualar ventas activas.

## 9. Cierre, resultado, ganadores y premios

1. `PATCH /draws/shifts/:shiftId/close` cierra ventas.
2. Un nuevo `POST /sales` contra el turno cerrado debe responder `422`.
3. `POST /results` publica el número ganador una sola vez por turno.
4. `GET /results`, `GET /results/:resultId` consultan el resultado.
5. `GET /results/:resultId/winning-sales` obtiene únicamente ventas activas con el número ganador.
6. `POST /prize-payments` registra el pago de una venta ganadora y el actor administrativo.
7. `GET /prize-payments` y `GET /prize-payments/:saleId` verifican el pago.
8. Un segundo pago para la misma venta debe responder `409`.

## 10. Corte y reportes de fin de día

1. `POST /cash-cuts` crea el corte para el rango del día.
2. `GET /cash-cuts`, `GET /cash-cuts/:cutId` verifican el documento.
3. `GET /cash-cuts/:cutId/summary` debe conciliar venta activa, anulaciones, premios pagados y saldo.
4. `GET /reports/analytics` entrega indicadores agregados.
5. `GET /reports/overview` entrega el resumen operacional del período.
6. `GET /reports/sellers` desglosa desempeño por vendedor.

Condición de cierre aceptable: turno cerrado, resultado publicado, ganadores identificados, premios registrados o pendientes explícitos, corte generado y totales de matriz/reporte conciliados.

## 11. Notificaciones y auditoría

1. `GET /notifications` y `GET /notifications/unread-count` cargan la bandeja privada del usuario.
2. `PATCH /notifications/:id/read` marca una notificación propia.
3. `PATCH /notifications/read-all` marca todas las propias.
4. `DELETE /notifications/:id` elimina únicamente una notificación propia.
5. `GET /audit-events` y `GET /audit-events/:eventId` permiten trazabilidad tenant-scoped.

Las revisiones financieras no se insertan en el ledger tenant: usan `payment_reviews`, que es inmutable y conserva al administrador AlphaBy. Esto evita mezclar contextos y mantiene atómica la aprobación.

## Estado de evidencia al 3 de agosto de 2026

- Certificación dinámica: 90/90 rutas de controladores ejecutadas; si aparece una ruta nueva sin ejercicio, el comando falla.
- Recorrido operacional: 107 comprobaciones, 0 fallos.
- Recorrido SaaS completo: 30 hitos aprobados desde catálogo/alta/pago hasta logout, incluyendo venta, cierre, resultado, premio y corte.
- Regresión unitaria: 71 suites y 233 pruebas aprobadas.
- Base de datos: 2 suites SQL transaccionales aprobadas para aislamiento RLS, funciones, triggers, facturación y revisión bancaria.
- E2E: 1 suite aprobada; el smoke Realtime permanece condicional a sus credenciales/fixtures dedicados.
- Supabase development: 22 migraciones locales/remotas sincronizadas hasta `20260803163000`; linter de `public` y `app_private` sin warnings.
- Compilación, lint, formato, Prisma y referencia HTTP: aprobados.

El Supabase Auth alojado puede responder `429` al alta pública mientras no se
configure SMTP propio. La certificación detecta esa restricción y prepara el
usuario QA mediante service role, pero ejecuta el mismo límite SQL atómico
`app_private.start_paid_signup`; no existe un backdoor HTTP de producción.
