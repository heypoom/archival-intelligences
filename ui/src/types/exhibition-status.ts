export type ExhibitionStatus =
  | {type: 'wait'; next: string}
  | {type: 'active'; start: string}
  | {type: 'closed'}
  | {type: 'loading'}
