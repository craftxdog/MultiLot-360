import { DocumentBuilder } from '@nestjs/swagger';

export const buildSwaggerConfig = (appName: string) =>
  new DocumentBuilder()
    .setTitle(appName)
    .setDescription(
      'API operacional de MultiLot 360. PostgreSQL es la fuente de verdad; Socket.IO solo notifica cambios confirmados. Todas las rutas privadas requieren un access token de Supabase y pueden exigir módulo, rol y permiso RBAC.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-id',
        description:
          'Tenant UUID or slug. Optional when the user has only one active company.',
      },
      'tenant',
    )
    .addTag('Health', 'Estado del proceso y sus dependencias.')
    .addTag('Auth', 'Sesiones, identidad y recuperación de contraseña.')
    .addTag(
      'SaaS billing',
      'Planes, alta pagada de empresas y webhooks de suscripción.',
    )
    .addTag(
      'Seller onboarding',
      'Invitación, activación y administración de vendedores.',
    )
    .addTag(
      'Draws',
      'Configuraciones recurrentes y turnos operacionales de sorteos.',
    )
    .addTag(
      'Number limits',
      'Topes globales o por vendedor, con alcance general o por sorteo.',
    )
    .addTag(
      'Blocked numbers',
      'Bloqueos temporales de números por fecha o turno.',
    )
    .addTag('Sales', 'Ventas multi-número, consulta, política y anulación.')
    .addTag(
      'Sales Matrix',
      'Vista administrativa 00-99 de la exposición vendida.',
    )
    .addTag('Results', 'Resultados y ventas ganadoras por turno.')
    .addTag('Prize payments', 'Registro de premios efectivamente pagados.')
    .addTag('Cash cuts', 'Cierres contables por vendedor y período.')
    .addTag('Reports', 'Resumen operacional y desempeño por vendedor.')
    .addTag('System parameters', 'Configuración operacional administrable.')
    .addTag(
      'System parameters - access control',
      'Administración de roles, módulos y permisos RBAC del tenant.',
    )
    .addTag(
      'Notifications',
      'Notificaciones del usuario, conteo de pendientes y confirmación de lectura.',
    )
    .addTag('Audit events', 'Trazabilidad técnica y de acciones de negocio.')
    .build();
