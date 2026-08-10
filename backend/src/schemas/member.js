/**
 * 멤버 스키마
 */

export const memberResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    name_en: { type: 'string' },
    birth_date: { type: 'string' },
    position: { type: 'string' },
    is_former: { type: 'boolean' },
  },
};
