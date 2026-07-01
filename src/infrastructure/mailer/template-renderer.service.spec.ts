import { TemplateRendererService } from './template-renderer.service';

describe('TemplateRendererService', () => {
  let service: TemplateRendererService;

  beforeEach(() => {
    service = new TemplateRendererService();
  });

  it('renders seller access code templates', () => {
    const rendered = service.render('seller-access-code', {
      appName: 'MultiLot 360 API',
      sellerName: 'Ana',
      accessCode: '123456',
      expiresInMinutes: 10,
      activationUrl:
        'https://app.multilot360.com/activar-vendedor?email=ana%40example.com&code=123456',
    });

    expect(rendered.html).toContain('123456');
    expect(rendered.html).toContain(
      'https://app.multilot360.com/activar-vendedor',
    );
    expect(rendered.text).toContain('Ana');
  });

  it('renders a Gmail-compatible invitation with a fallback link', () => {
    const activationUrl =
      'https://app.multilot360.com/activar-vendedor?email=ana%40example.com&code=654321';
    const rendered = service.render('seller-invitation', {
      appName: 'MultiLot 360 API',
      brandName: 'MultiLot 360',
      adminName: 'Admin Principal',
      sellerName: 'Ana',
      accessCode: '654321',
      expiresInMinutes: 15,
      activationUrl,
      supportEmail: 'soporte@multilot360.com',
      currentYear: 2026,
    });

    expect(rendered.html).toContain('role="presentation"');
    expect(rendered.html).toContain('Activar mi cuenta');
    expect(rendered.html).toContain(activationUrl.replaceAll('&', '&amp;'));
    expect(rendered.html).toContain('654321');
    expect(rendered.text).toContain(activationUrl);
  });

  it('escapes dynamic values in HTML emails', () => {
    const rendered = service.render('seller-access-code', {
      appName: 'MultiLot 360 API',
      brandName: 'MultiLot 360',
      sellerName: '<script>alert(1)</script>',
      accessCode: '123456',
      expiresInMinutes: 15,
      activationUrl:
        'https://app.multilot360.com/activar-vendedor?email=test%40example.com&code=123456',
      supportEmail: 'soporte@multilot360.com',
      currentYear: 2026,
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });
});
