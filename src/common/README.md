# Common

`common` contiene piezas transversales de la capa HTTP/Nest:

- decoradores de controladores;
- DTOs base de entrada HTTP;
- filtros, interceptores y middleware globales;
- utilidades de request, token bearer, cursor y paginacion HTTP;
- tipos de contexto/request/response usados por la presentacion.

Reglas:

- No colocar aqui reglas de negocio de un modulo.
- No colocar contratos puros del dominio; esos viven en `shared-kernel`.
- No colocar adaptadores de proveedores externos; esos viven en `infrastructure`.
- Si un archivo no es usado por HTTP global o por varios modulos, debe vivir en su modulo propietario.
