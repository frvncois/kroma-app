export interface Printshop {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

export const printshops: Printshop[] = [
  {
    id: 'in-house',
    name: 'In House',
    address: '123 Main St, Toronto, ON M5V 2T6',
    lat: 43.6426,
    lng: -79.3871,
  },
  {
    id: 'victor',
    name: 'Victor',
    address: '456 Queen St W, Toronto, ON M5V 2A8',
    lat: 43.6481,
    lng: -79.4042,
  },
  {
    id: 'studio-c',
    name: 'Studio C',
    address: '789 King St E, Toronto, ON M5A 1M2',
    lat: 43.6529,
    lng: -79.3617,
  },
]
