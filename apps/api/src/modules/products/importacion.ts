import ExcelJS from 'exceljs';
import { AppError } from '../../common/errors/app-error.js';
import type { ProductInput } from './products.schema.js';

// Plantilla de Excel para cargar productos de una categoría y lectura del archivo
// completo (Excel o CSV). Acá se revisa el formato fila por fila para poder decir
// dónde está cada error; las reglas de negocio las vuelve a aplicar la base.

export interface AtributoCategoria {
  id: string;
  nombre: string;
  tipo: 'texto' | 'numero' | 'lista' | 'si_no';
  unidad: string | null;
  obligatorio: boolean;
  define_variante: boolean;
  opciones: { id: string; valor: string }[];
}

export interface ErrorImportacion {
  fila: number | null;
  columna: string | null;
  mensaje: string;
}

export interface ProductoLeido {
  /** Clave interna del grupo: el código de la planilla o "fila-N" si vino vacío. */
  clave: string;
  codigo: string | null;
  filas: number[];
  datos: ProductInput;
}

export interface ArchivoLeido {
  categoriaId: string | null;
  encabezados: string[];
  filas: { numero: number; celdas: Celda[] }[];
}

type Celda = string | number | null;
type Clave = 'codigo' | 'nombre' | 'descripcion' | 'precio' | 'precio_oferta' | 'stock' | 'sku';

interface Columna {
  titulo: string;
  clave?: Clave;
  atributo?: AtributoCategoria;
  obligatoria: boolean;
  ayuda: string;
  ancho: number;
}

export const MAX_FILAS = 2000;
export const MAX_PRODUCTOS = 500;
const MAX_ERRORES = 200;
const FILAS_CON_LISTAS = 1000;
const HOJA_PRODUCTOS = 'Productos';
const HOJA_LISTAS = 'Listas';
const MARCA = 'plantilla-productos';

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** "Peso (kg) *" y "peso" son la misma columna. */
const claveColumna = (titulo: string) => normalizar(titulo.replace(/\([^)]*\)\s*\*?\s*$/, ''));

const listaCorta = (valores: string[], max = 12) =>
  valores.length > max ? `${valores.slice(0, max).join(', ')}…` : valores.join(', ');

function ayudaFicha(a: AtributoCategoria) {
  switch (a.tipo) {
    case 'lista':
      return `Elegí una opción de la lista (${listaCorta(a.opciones.map((o) => o.valor))}).`;
    case 'numero':
      return a.unidad ? `Un número, en ${a.unidad}.` : 'Un número.';
    case 'si_no':
      return 'Sí o No.';
    default:
      return 'Texto libre, hasta 200 caracteres.';
  }
}

export function columnasDe(atributos: AtributoCategoria[]): Columna[] {
  const variantes = atributos.filter((a) => a.define_variante);
  const ficha = atributos.filter((a) => !a.define_variante);
  return [
    {
      titulo: 'Código de producto',
      clave: 'codigo',
      obligatoria: false,
      ayuda: variantes.length
        ? 'Las filas con el mismo código son variantes de un mismo producto. Si lo dejás vacío, la fila es un producto aparte.'
        : 'Opcional: te ayuda a encontrar el producto en la vista previa. Usá un código distinto en cada fila.',
      ancho: 18,
    },
    {
      titulo: 'Nombre',
      clave: 'nombre',
      obligatoria: true,
      ayuda: 'Entre 3 y 120 caracteres. En las otras variantes del mismo código podés dejarlo vacío.',
      ancho: 36,
    },
    { titulo: 'Descripción', clave: 'descripcion', obligatoria: false, ayuda: 'Hasta 5000 caracteres.', ancho: 40 },
    ...variantes.map((a) => ({
      titulo: a.nombre,
      atributo: a,
      obligatoria: true,
      ayuda: `Variante. ${ayudaFicha(a)}`,
      ancho: 16,
    })),
    { titulo: 'Precio', clave: 'precio', obligatoria: true, ayuda: 'Sin el signo $. Con decimales: 12500,50.', ancho: 12 },
    {
      titulo: 'Precio de oferta',
      clave: 'precio_oferta',
      obligatoria: false,
      ayuda: 'Opcional. Tiene que ser menor que el precio.',
      ancho: 16,
    },
    { titulo: 'Stock', clave: 'stock', obligatoria: true, ayuda: 'Unidades disponibles (número entero).', ancho: 10 },
    {
      titulo: 'SKU',
      clave: 'sku',
      obligatoria: false,
      ayuda: 'Opcional: tu código interno de la variante, hasta 60 caracteres.',
      ancho: 14,
    },
    ...ficha.map((a) => ({
      titulo: a.unidad ? `${a.nombre} (${a.unidad})` : a.nombre,
      atributo: a,
      obligatoria: a.obligatorio,
      ayuda: ayudaFicha(a),
      ancho: Math.max(14, Math.min(28, a.nombre.length + 4)),
    })),
  ];
}

const tituloConMarca = (c: Columna) => (c.obligatoria ? `${c.titulo} *` : c.titulo);
const letra = (n: number) => {
  let s = '';
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

type ConValidaciones = { dataValidations: { add(rango: string, v: ExcelJS.DataValidation): void } };

// ---------------------------------------------------------------------------
// Plantilla
// ---------------------------------------------------------------------------

export async function generarPlantilla(
  categoria: { id: string; etiqueta: string },
  atributos: AtributoCategoria[]
): Promise<Buffer> {
  const columnas = columnasDe(atributos);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Tu Comercio Local';
  libro.title = `Plantilla de productos: ${categoria.etiqueta}`;

  const hoja = libro.addWorksheet(HOJA_PRODUCTOS, { views: [{ state: 'frozen', ySplit: 1 }] });
  const instrucciones = libro.addWorksheet('Instrucciones');
  const listas = libro.addWorksheet(HOJA_LISTAS, { state: 'hidden' });

  // La hoja oculta lleva la categoría: al subir el archivo no hace falta volver a elegirla.
  listas.getCell('A1').value = MARCA;
  listas.getCell('A2').value = categoria.id;

  hoja.columns = columnas.map((c) => ({ header: tituloConMarca(c), width: c.ancho }));
  const encabezado = hoja.getRow(1);
  encabezado.height = 30;
  columnas.forEach((c, i) => {
    const celda = encabezado.getCell(i + 1);
    celda.font = { bold: true, color: { argb: c.obligatoria ? 'FFFFFFFF' : 'FF1F2937' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.obligatoria ? 'FFE8590C' : 'FFF1F2F4' } };
    celda.alignment = { vertical: 'middle', wrapText: true };
    celda.note = c.ayuda;
  });

  const validaciones = (hoja as unknown as ConValidaciones).dataValidations;
  let columnaLista = 2;
  columnas.forEach((c, i) => {
    const rango = `${letra(i + 1)}2:${letra(i + 1)}${FILAS_CON_LISTAS + 1}`;
    const a = c.atributo;
    if (a?.tipo === 'lista' && a.opciones.length) {
      const col = letra(columnaLista++);
      listas.getCell(`${col}1`).value = a.nombre;
      a.opciones.forEach((o, j) => (listas.getCell(`${col}${j + 2}`).value = o.valor));
      validaciones.add(rango, {
        type: 'list',
        allowBlank: true,
        formulae: [`${HOJA_LISTAS}!$${col}$2:$${col}$${a.opciones.length + 1}`],
        showErrorMessage: true,
        errorTitle: a.nombre,
        error: `Elegí una opción de la lista de «${a.nombre}».`,
      });
    } else if (a?.tipo === 'si_no') {
      validaciones.add(rango, {
        type: 'list',
        allowBlank: true,
        formulae: ['"Sí,No"'],
        showErrorMessage: true,
        errorTitle: a.nombre,
        error: 'Elegí Sí o No.',
      });
    } else if (c.clave === 'precio' || c.clave === 'precio_oferta' || a?.tipo === 'numero') {
      validaciones.add(rango, {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: c.titulo,
        error: 'Ingresá un número (sin el signo $).',
      });
    } else if (c.clave === 'stock') {
      validaciones.add(rango, {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: 'Stock',
        error: 'El stock es un número entero, sin decimales.',
      });
    }
  });

  escribirInstrucciones(instrucciones, categoria.etiqueta, columnas);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

function escribirInstrucciones(hoja: ExcelJS.Worksheet, etiqueta: string, columnas: Columna[]) {
  const hayVariantes = columnas.some((c) => c.atributo?.define_variante);
  hoja.columns = [{ width: 26 }, { width: 14 }, { width: 90 }];

  const titulo = hoja.addRow([`Plantilla de productos · ${etiqueta}`]);
  titulo.font = { bold: true, size: 14 };
  hoja.addRow([]);

  const pasos = [
    'Completá la hoja «Productos»: una fila por producto' + (hayVariantes ? ' o por variante.' : '.'),
    'Las columnas con * (en naranja) son obligatorias. Las que tienen lista desplegable solo aceptan esos valores.',
    ...(hayVariantes
      ? [
          'Para cargar un producto con variantes (por ejemplo, varios talles o colores), usá una fila por variante con el mismo «Código de producto».',
          'El nombre, la descripción y la ficha se toman de la primera fila de cada código: en las demás podés dejarlos vacíos.',
        ]
      : []),
    'No cambies los títulos de las columnas ni el nombre de las hojas.',
    `Hasta ${MAX_PRODUCTOS} productos y ${MAX_FILAS} filas por archivo.`,
    'Subí el archivo en «Carga por lote»: antes de guardar vas a ver una vista previa con los errores de cada fila.',
    'Las fotos se agregan después, desde la lista de productos importados.',
  ];
  hoja.addRow(['Cómo completarla']).font = { bold: true };
  pasos.forEach((p, i) => hoja.addRow([`${i + 1}. ${p}`]));
  hoja.addRow([]);

  const cabecera = hoja.addRow(['Columna', 'Obligatoria', 'Qué poner']);
  cabecera.font = { bold: true };
  cabecera.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } };
  });
  for (const c of columnas) {
    const fila = hoja.addRow([c.titulo, c.obligatoria ? 'Sí' : 'No', c.ayuda]);
    fila.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    fila.alignment = { vertical: 'top' };
  }
}

// ---------------------------------------------------------------------------
// Lectura del archivo
// ---------------------------------------------------------------------------

function valorCelda(v: ExcelJS.CellValue): Celda {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if ('result' in v) return valorCelda(v.result as ExcelJS.CellValue);
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return valorCelda(v.text as ExcelJS.CellValue);
  return null;
}

async function leerExcel(buffer: Buffer): Promise<ArchivoLeido> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new AppError('No pudimos abrir el archivo. Guardalo como Excel (.xlsx) o CSV y probá de nuevo.', 400);
  }

  const listas = libro.getWorksheet(HOJA_LISTAS);
  const categoriaId =
    listas?.getCell('A1').value === MARCA ? String(valorCelda(listas.getCell('A2').value) ?? '') || null : null;

  const hoja = libro.getWorksheet(HOJA_PRODUCTOS) ?? libro.worksheets.find((h) => h.state === 'visible');
  if (!hoja) throw new AppError('El archivo no tiene la hoja «Productos»', 400);

  const ancho = hoja.getRow(1).cellCount;
  const encabezados = Array.from({ length: ancho }, (_, i) => String(valorCelda(hoja.getRow(1).getCell(i + 1).value) ?? ''));
  const filas: ArchivoLeido['filas'] = [];
  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero === 1) return;
    filas.push({ numero, celdas: Array.from({ length: ancho }, (_, i) => valorCelda(fila.getCell(i + 1).value)) });
  });
  return { categoriaId, encabezados, filas };
}

function decodificar(buffer: Buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    // Excel en castellano guarda los CSV en Windows-1252.
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function leerCsv(buffer: Buffer): ArchivoLeido {
  const texto = decodificar(buffer);
  const primera = texto.split(/\r?\n/, 1)[0];
  const separador = [';', ',', '\t'].reduce((a, b) => (primera.split(b).length > primera.split(a).length ? b : a));

  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === separador) {
      registro.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
    } else campo += c;
  }
  if (campo || registro.length) registros.push([...registro, campo]);

  const [encabezados = [], ...resto] = registros;
  return {
    categoriaId: null,
    encabezados,
    filas: resto.map((celdas, i) => ({ numero: i + 2, celdas: celdas.map((c) => (c === '' ? null : c)) })),
  };
}

export async function leerArchivo(archivo: { buffer: Buffer; originalname: string }): Promise<ArchivoLeido> {
  const nombre = archivo.originalname.toLowerCase();
  const leido = nombre.endsWith('.csv') ? leerCsv(archivo.buffer) : await leerExcel(archivo.buffer);
  const conDatos = leido.filas.filter((f) => f.celdas.some((c) => c !== null && String(c).trim() !== ''));
  if (conDatos.length > MAX_FILAS) {
    throw new AppError(`El archivo tiene ${conDatos.length} filas: se pueden importar hasta ${MAX_FILAS} por vez`, 400);
  }
  return { ...leido, filas: conDatos };
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

const textoDe = (v: Celda) => (v === null ? '' : String(v).trim());

/** Acepta 12500, "12500,50", "12.500,50", "$ 12.500" y "12500.5". Undefined si no es un número. */
export function numeroDe(v: Celda): number | null | undefined {
  if (v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  let s = v.replace(/[$\s]/g, '');
  if (!s) return null;
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma >= 0) {
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return /^-?\d+(\.\d+)?$/.test(s) && Number.isFinite(n) ? n : undefined;
}

function siNoDe(v: string): 'Sí' | 'No' | undefined {
  const n = normalizar(v);
  if (['si', 's', 'true', 'verdadero', '1', 'x'].includes(n)) return 'Sí';
  if (['no', 'n', 'false', 'falso', '0'].includes(n)) return 'No';
  return undefined;
}

export function validarFilas(
  archivo: ArchivoLeido,
  atributos: AtributoCategoria[],
  categoriaId: string
): { productos: ProductoLeido[]; errores: ErrorImportacion[]; avisos: string[] } {
  const columnas = columnasDe(atributos);
  const errores: ErrorImportacion[] = [];
  const avisos: string[] = [];
  let omitidos = 0;
  const error = (fila: number | null, columna: string | null, mensaje: string) => {
    if (errores.length < MAX_ERRORES) errores.push({ fila, columna, mensaje });
    else omitidos++;
  };
  const conOmitidos = () =>
    omitidos ? [...errores, { fila: null, columna: null, mensaje: `Y ${omitidos} errores más: corregí estos y volvé a subir el archivo.` }] : errores;

  // Columnas del archivo -> columnas de la categoría ---------------------------
  const indice = new Map<Columna, number>();
  const usadas = new Set<number>();
  for (const c of columnas) {
    const buscada = claveColumna(c.titulo);
    const i = archivo.encabezados.findIndex(
      (e, j) => !usadas.has(j) && (claveColumna(e) === buscada || normalizar(e) === normalizar(c.titulo))
    );
    if (i >= 0) {
      indice.set(c, i);
      usadas.add(i);
    } else if (c.obligatoria) {
      error(1, c.titulo, `Falta la columna «${c.titulo}». Descargá la plantilla de esta categoría y copiá tus datos ahí.`);
    }
  }
  const sobrantes = archivo.encabezados.filter((e, i) => e.trim() && !usadas.has(i));
  if (sobrantes.length) {
    avisos.push(`Estas columnas no son de esta categoría y no se importan: ${listaCorta(sobrantes, 6)}.`);
  }
  if (errores.length) return { productos: [], errores, avisos };
  if (!archivo.filas.length) {
    error(null, null, 'La hoja «Productos» no tiene filas con datos');
    return { productos: [], errores, avisos };
  }

  const celda = (fila: Celda[], c: Columna) => (indice.has(c) ? fila[indice.get(c)!] ?? null : null);
  const porClave = (clave: Clave) => columnas.find((c) => c.clave === clave)!;
  const deVariante = columnas.filter((c) => c.atributo?.define_variante);
  const deFicha = columnas.filter((c) => c.atributo && !c.atributo.define_variante);
  const opcion = (a: AtributoCategoria, valor: string) => a.opciones.find((o) => normalizar(o.valor) === normalizar(valor));

  const grupos = new Map<string, { producto: ProductoLeido; combinaciones: Map<string, number>; base: Map<Columna, string> }>();

  for (const { numero, celdas } of archivo.filas) {
    const codigo = textoDe(celda(celdas, porClave('codigo'))) || null;
    if (codigo && codigo.length > 60) error(numero, 'Código de producto', 'Máximo 60 caracteres');
    const clave = codigo ? normalizar(codigo) : `fila-${numero}`;
    let grupo = grupos.get(clave);

    if (!grupo) {
      // Primera fila del producto: nombre, descripción y ficha.
      const nombre = textoDe(celda(celdas, porClave('nombre')));
      if (!nombre) error(numero, 'Nombre', 'Completá el nombre del producto');
      else if (nombre.length < 3 || nombre.length > 120) error(numero, 'Nombre', 'El nombre tiene que tener entre 3 y 120 caracteres');
      const descripcion = textoDe(celda(celdas, porClave('descripcion')));
      if (descripcion.length > 5000) error(numero, 'Descripción', 'Máximo 5000 caracteres');

      const atributosProducto: ProductInput['atributos'] = [];
      const base = new Map<Columna, string>();
      for (const c of deFicha) {
        const a = c.atributo!;
        const valor = celda(celdas, c);
        const crudo = textoDe(valor);
        base.set(c, crudo);
        if (!crudo) {
          if (a.obligatorio) error(numero, c.titulo, `Completá «${a.nombre}»`);
          continue;
        }
        if (a.tipo === 'lista') {
          const o = opcion(a, crudo);
          if (!o) error(numero, c.titulo, `«${crudo}» no es una opción de «${a.nombre}». Opciones: ${listaCorta(a.opciones.map((x) => x.valor))}`);
          else atributosProducto.push({ atributo_id: a.id, opcion_id: o.id });
        } else if (a.tipo === 'numero') {
          const n = numeroDe(valor);
          if (n === undefined || n === null) error(numero, c.titulo, `«${crudo}» no es un número`);
          else atributosProducto.push({ atributo_id: a.id, valor_numero: n });
        } else if (a.tipo === 'si_no') {
          const s = siNoDe(crudo);
          if (!s) error(numero, c.titulo, `Poné Sí o No en «${a.nombre}»`);
          else atributosProducto.push({ atributo_id: a.id, valor_texto: s });
        } else if (crudo.length > 200) {
          error(numero, c.titulo, 'Máximo 200 caracteres');
        } else {
          atributosProducto.push({ atributo_id: a.id, valor_texto: crudo });
        }
      }
      base.set(porClave('nombre'), nombre);
      base.set(porClave('descripcion'), descripcion);

      grupo = {
        producto: {
          clave,
          codigo,
          filas: [],
          datos: {
            categoria_id: categoriaId,
            nombre,
            descripcion: descripcion || null,
            atributos: atributosProducto,
            variantes: [],
          },
        },
        combinaciones: new Map(),
        base,
      };
      grupos.set(clave, grupo);
    } else {
      const primera = grupo.producto.filas[0];
      if (!deVariante.length) {
        error(numero, 'Código de producto', `Esta categoría no usa variantes y el código «${codigo}» ya está en la fila ${primera}. Usá un código distinto para cada producto.`);
        continue;
      }
      // Las demás filas del producto pueden repetir los datos de la primera, pero no cambiarlos.
      for (const [c, valor] of grupo.base) {
        const otro = textoDe(celda(celdas, c));
        if (otro && normalizar(otro) !== normalizar(valor)) {
          error(numero, c.titulo, `No coincide con la fila ${primera} (mismo código). Dejalo vacío o repetí el mismo valor.`);
        }
      }
    }

    grupo.producto.filas.push(numero);

    // Variante: opciones, precio, oferta, stock y SKU.
    const opciones: { atributo_id: string; opcion_id: string }[] = [];
    const nombres: string[] = [];
    for (const c of deVariante) {
      const a = c.atributo!;
      const crudo = textoDe(celda(celdas, c));
      if (!crudo) {
        error(numero, c.titulo, `Completá «${a.nombre}»`);
        continue;
      }
      const o = opcion(a, crudo);
      if (!o) {
        error(numero, c.titulo, `«${crudo}» no es una opción de «${a.nombre}». Opciones: ${listaCorta(a.opciones.map((x) => x.valor))}`);
        continue;
      }
      opciones.push({ atributo_id: a.id, opcion_id: o.id });
      nombres.push(`${a.nombre} ${o.valor}`);
    }
    if (opciones.length === deVariante.length && deVariante.length) {
      const combinacion = opciones.map((o) => o.opcion_id).sort().join('|');
      const repetida = grupo.combinaciones.get(combinacion);
      if (repetida) error(numero, null, `La combinación ${nombres.join(', ')} ya está en la fila ${repetida}`);
      else grupo.combinaciones.set(combinacion, numero);
    }

    const precio = numeroDe(celda(celdas, porClave('precio')));
    if (precio === null) error(numero, 'Precio', 'Completá el precio');
    else if (precio === undefined) error(numero, 'Precio', 'El precio tiene que ser un número, sin el signo $');
    else if (precio <= 0) error(numero, 'Precio', 'El precio tiene que ser mayor a 0');
    else if (precio > 9_999_999_999.99) error(numero, 'Precio', 'Importe demasiado alto');

    const oferta = numeroDe(celda(celdas, porClave('precio_oferta')));
    if (oferta === undefined) error(numero, 'Precio de oferta', 'Tiene que ser un número, sin el signo $');
    else if (oferta !== null && (oferta < 0 || (precio && oferta >= precio))) {
      error(numero, 'Precio de oferta', 'La oferta tiene que ser menor que el precio');
    }

    const stock = numeroDe(celda(celdas, porClave('stock')));
    if (stock === null) error(numero, 'Stock', 'Completá el stock');
    else if (stock === undefined || !Number.isInteger(stock) || stock < 0) {
      error(numero, 'Stock', 'El stock es un número entero, sin decimales');
    }

    const sku = textoDe(celda(celdas, porClave('sku')));
    if (sku.length > 60) error(numero, 'SKU', 'Máximo 60 caracteres');

    grupo.producto.datos.variantes.push({
      opciones,
      precio: precio ?? 0,
      precio_oferta: oferta ?? null,
      stock: stock ?? 0,
      sku: sku || null,
    });
  }

  const productos = [...grupos.values()].map((g) => g.producto);
  if (productos.length > MAX_PRODUCTOS) {
    error(null, null, `El archivo tiene ${productos.length} productos: se pueden importar hasta ${MAX_PRODUCTOS} por vez`);
  }
  return { productos, errores: conOmitidos(), avisos };
}
