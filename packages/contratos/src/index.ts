// Contratos: la forma de lo que devuelven las funciones pkg_* de la base.
// La API los verifica en desarrollo, la web toma de acá sus tipos (solo `import type`,
// así no suma nada al navegador) y las pruebas de la base los comprueban.
// Se agregan de a un módulo; lo que todavía no está acá sigue tipado a mano en la web.
export * from './verificar.js';
export * from './rubros.js';
export * from './tiendas.js';
export * from './categorias.js';
