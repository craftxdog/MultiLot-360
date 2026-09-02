# Alta y operación de tenants

Este documento describe el procedimiento canónico para vender, crear, cobrar,
activar y operar una empresa en MultiLot 360. La identidad es global; todos los
datos operativos, roles, permisos, vendedores, sorteos, ventas, resultados,
premios, parámetros y documentos comerciales pertenecen a un `tenant_id`.

## Operadores internos de AlphaBy

- `OWNER`: propietario del SaaS. Puede revisar facturación y recibe una
  membresía de soporte auditable en todos los tenants.
- `SUPPORT`: soporte interno. Recibe una membresía `ADMIN` explícitamente
  marcada como soporte en todos los tenants actuales y futuros, pero no se
  convierte en propietario ni vendedor.
- `BILLING`: operador financiero sin acceso global automático a la operación de
  los tenants.

El acceso global nunca omite el contexto tenant. OWNER y SUPPORT deben elegir
explícitamente el slug de la empresa al iniciar sesión. Cada operación queda
asociada a su perfil y membresía; no se usa una sesión anónima ni se desactiva
RLS.

La cuenta canónica de soporte es `support@alphaby.cloud`, con nombre visible
`Soporte Tecnico` y username técnico `soporte.tecnico`. Usa una sola identidad
de Supabase Auth y una membresía explícita `ADMIN` marcada con
`es_soporte_plataforma=true` en cada tenant. La membresía `ADMIN` es necesaria
porque algunos endpoints administrativos validan tanto permisos granulares
como el nombre del rol; la marca de soporte conserva la distinción auditable y
no concede propiedad (`es_propietario=false`) ni crea un vendedor. La
contraseña nunca se guarda en SQL, migraciones, documentación o Git: se carga
únicamente mediante Supabase Auth Admin y debe rotarse y protegerse con MFA.

## Catálogo comercial inicial

| Código | Precio mensual | Canal inicial |
| --- | ---: | --- |
| `STARTER` | USD 10.00 | Transferencia bancaria |
| `BUSINESS` | USD 25.00 | Transferencia bancaria |
| `ENTERPRISE` | USD 50.00 | Transferencia bancaria |

PayPal se conserva como canal opcional, pero permanece desactivado hasta cargar
identificadores reales del proveedor y habilitar `PAYPAL_ENABLED` en producción.
Los datos bancarios reales se registran por separado en
`billing_bank_accounts`; nunca se inventan ni se guardan en el repositorio.

## Flujo comercial desde cero

1. El prospecto consulta `GET /api/v1/billing/plans?channel=BANK_TRANSFER`.
2. El frontend envía `POST /api/v1/billing/signup` con correo, contraseña,
   nombre, username, slug de empresa, moneda, zona horaria, precio y método de
   pago.
3. La API crea la identidad en Supabase Auth y, dentro de una transacción,
   provisiona:
   - perfil global en `usuarios`;
   - empresa en `tenants` con estado `PENDIENTE_PAGO`;
   - copia tenant-scoped de roles y permisos;
   - membresía ADMIN propietaria con permiso de facturación;
   - cuenta de facturación, suscripción incompleta y sesión de onboarding;
   - evento outbox para trazabilidad.
4. Antes del primer pago solo el propietario o una membresía con permiso
   billing puede entrar, y únicamente al portal de facturación.
5. El propietario confirma el correo. La API emite la factura inicial y muestra
   las cuentas bancarias activas que coincidan con la moneda.
6. El propietario registra la transferencia y adjunta evidencia. La referencia,
   importe, moneda, archivo y hash quedan auditados.
7. Un OWNER/BILLING interno revisa la transferencia. La aprobación crea un
   movimiento inmutable, marca factura y suscripción como pagadas/activas y
   cambia el tenant a `ACTIVO`.
8. A partir de ese momento el propietario configura la operación e invita a su
   equipo.

El alta requiere `AUTH_SIGNUP_ENABLED=true` en la aplicación desplegada. Con
`false`, `POST /api/v1/billing/signup` responde 403 y el frontend muestra que el
registro inicial está deshabilitado; este flag se reserva como apagado de
emergencia.

## Configuración operativa inicial

Dentro del tenant activo, el propietario debe completar en este orden:

1. **Empresa y facturación**: razón social, identificación fiscal, correo de
   facturación, moneda y cuenta receptora publicada por AlphaBy.
2. **Roles y permisos**: revisar ADMIN/VENDEDOR; crear roles adicionales si la
   empresa necesita supervisores o caja.
3. **Parámetros**: pago por mil, días de cambio de ticket, ventana de anulación,
   montos decimales y notificaciones de metas.
4. **Sorteos**: crear código, hora, calendario, cierre previo, reapertura y
   generación automática de turnos. No se inventan horarios en el bootstrap.
5. **Usuarios y vendedores**: invitar por correo, confirmar acceso y verificar
   que vendedores no tengan permiso billing.
6. **Límites y bloqueos**: establecer límites generales/específicos y números
   bloqueados para cada sorteo.
7. **Prueba controlada**: crear turno, venta pequeña, resultado, premio, pago y
   corte; verificar ticket, reportes, matriz, auditoría y notificaciones.
8. **Salida a operación**: revisar que no haya datos de certificación, habilitar
   vendedores reales y conservar evidencia de la prueba de aceptación.

## Tenant interno `atlasby`

`atlasby` se provisiona como prueba interna de 30 días usando STARTER. Su dueño
es `craftzdog@alphaby.cloud`, tiene roles/permisos y parámetros copiados desde
la plantilla canónica, cuenta de facturación y suscripción de prueba. Los
horarios de sorteos deben configurarse deliberadamente desde la API/UI porque
son una decisión comercial, no un valor técnico seguro.

## Renovación y morosidad

- La factura se emite antes del siguiente período.
- Al vencimiento entra en gracia sin borrar datos.
- Si la gracia termina, la suscripción y el tenant pasan a morosidad/suspensión
  según el ciclo de facturación.
- Propietario y billing mantienen acceso al portal para regularizar.
- Vendedores no pueden operar un tenant suspendido.
- La reactivación ocurre solo después de una confirmación de pago idempotente.

## Comprobaciones obligatorias

- RLS habilitado en todas las tablas públicas.
- Consultas operativas siempre filtradas por `tenant_id` además de RLS.
- OWNER/SUPPORT seleccionan tenant explícitamente cuando tienen más de uno.
- La cuenta `support@alphaby.cloud` tiene exactamente una membresía activa,
  no propietaria y marcada como soporte en cada tenant activo.
- Ningún usuario Auth sin perfil/membresía puede entrar a la API.
- Ningún vendedor puede abrir facturación.
- PayPal continúa apagado sin credenciales live.
- SMTP debe superar `verify()` y un envío real antes de abrir recuperación e
  invitaciones al público.
- `GET /health/ready`, catálogo público, login, billing, venta y cierre deben
  probarse después de cada despliegue.
