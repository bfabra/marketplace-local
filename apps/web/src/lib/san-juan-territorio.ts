/**
 * Departamentos → localidades / villas / zonas de San Juan
 * (docs/diseno/js/pages/merchant.js → sanJuanDepartments).
 * En la base solo viven los departamentos como `localidades`;
 * la villa/zona se elige en UI y se guarda en la dirección.
 */
export const LOCALIDADES_POR_DEPARTAMENTO: Record<string, string[]> = {
  Capital: ['San Juan'],
  Rivadavia: ['Rivadavia', 'La Bebida', 'Marquesado', 'Villa San Martín', 'Villa Tacú'],
  'Santa Lucía': ['Santa Lucía', 'Alto de Sierra', 'Colonia Gutiérrez', 'La Legua', 'Villa Don Bosco', 'Villa Hipódromo'],
  Rawson: ['Villa Krause', 'Rawson', 'El Medanito', 'Médano de Oro', 'Villa Bolaños', 'Colonia Rodas', 'Colonia Fiorito'],
  Pocito: ['Villa Aberastain', 'Carpintería', 'La Rinconada', 'Quinto Cuartel', 'Villa Independencia'],
  Zonda: ['Villa Basilio Nievas', 'Zonda'],
  Ullum: ['Villa Ibáñez', 'Ullum'],
  Chimbas: ['Chimbas', 'Villa Paula Albarracín de Sarmiento', 'El Mogote', 'Villa Obrera', 'Barrio Andacollo'],
  '9 de Julio': ['9 de Julio', 'Las Chacritas', 'Alto de Sierra', 'Villa Fiorito'],
  Albardón: [
    'Villa General San Martín',
    'Campo Afuera',
    'El Rincón',
    'El Topón',
    'La Cañada',
    'Las Tapias',
    'Las Lomitas',
    'Las Tierritas',
    'Las Piedritas',
  ],
  Angaco: ['Villa El Salvador', 'Las Tapias', 'Villa Sefair', 'Villa Sefair-Talacasto'],
  'San Martín': [
    'Villa San Martín',
    'San Isidro',
    'Dos Acequias',
    'Villa Dominguito',
    'Villa del Salvador',
    'La Puntilla',
    'Pie de Palo',
  ],
  Caucete: ['Caucete', 'Villa Independencia', 'Bermejo', 'El Rincón', 'Las Talas', 'Los Médanos', 'Vallecito', 'Pie de Palo'],
  '25 de Mayo': [
    'Santa Rosa',
    'Villa Santa Rosa',
    'Casuarinas',
    'Las Casuarinas',
    'La Chimbera',
    'El Encón',
    'Tupelí',
    'Villa Borjas',
    'Punta del Médano',
  ],
  Sarmiento: [
    'Villa Media Agua',
    'Los Berros',
    'Cochagual',
    'Cañada Honda',
    'Cienaguita',
    'Colonia Fiscal',
    'Divisadero',
    'Guanacache',
    'Pedernal',
    'Las Lagunas',
  ],
  Calingasta: [
    'Barreal',
    'Villa Calingasta',
    'Tamberías',
    'Sorocayense',
    'Villa Pituil',
    'Villa Nueva',
    'Hilario',
    'Puchuzum',
    'Alto Verde',
  ],
  Iglesia: [
    'Rodeo',
    'Villa Iglesia',
    'Bella Vista',
    'Las Flores',
    'Tudcum',
    'Angualasto',
    'Colola',
    'Pismanta',
    'Malimán',
    'Colangüil',
    'Achango',
    'El Llano',
    'Tocota',
    'Maipirinque',
    'Campanario-Zonda',
    'El Chinquillo',
  ],
  Jáchal: [
    'San José de Jáchal',
    'Huaco',
    'Mogna',
    'Niquivil',
    'La Falda',
    'El Médano',
    'Gran China',
    'San Isidro',
    'Pampa Vieja',
    'Tamberías',
  ],
  'Valle Fértil': [
    'San Agustín del Valle Fértil',
    'Astica',
    'Usno',
    'Baldes del Rosario',
    'Chucuma',
    'Los Baldecitos',
    'La Majadita',
    'La Mesada',
    'Las Casuarinas',
  ],
};

export function localidadesDeDepartamento(nombreDepartamento: string): string[] {
  return LOCALIDADES_POR_DEPARTAMENTO[nombreDepartamento] ?? [];
}

/** Extrae “Zona: …” guardada en la dirección del alta. */
export function zonaDesdeDireccion(direccion: string): string {
  const m = direccion.match(/(?:^|·)\s*Zona:\s*(.+?)\s*$/i);
  return m?.[1]?.trim() ?? '';
}

export function direccionConZona(calle: string, zona: string): string {
  const base = calle.trim();
  const z = zona.trim();
  if (!z) return base.slice(0, 200);
  const limpia = base.replace(/\s*·\s*Zona:\s*.+$/i, '').trim();
  return [limpia, `Zona: ${z}`].filter(Boolean).join(' · ').slice(0, 200);
}
