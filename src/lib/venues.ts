export interface Venue {
  id: string;
  name: string;
  hotel: string;
  location: string;
  dimensions: string;
  pricePerDay: number;
  capacity: number;
  sceneIndex: number;
  thumbnail: string;
  description: string;
}

export const VENUES: Venue[] = [
  {
    id: 'grand-hall',
    name: 'Grand Hall',
    hotel: 'Hotel Marriott',
    location: 'Tunis, Tunisia',
    dimensions: '45m × 70m',
    pricePerDay: 4500,
    capacity: 500,
    sceneIndex: 0,
    thumbnail: '/scenes/grand-hall-thumb.jpg',
    description: 'Elegant grand hall with high ceilings and classical architecture.',
  },
  {
    id: 'crystal-ballroom',
    name: 'Crystal Ballroom',
    hotel: 'Hotel Laico',
    location: 'Tunis, Tunisia',
    dimensions: '30m × 50m',
    pricePerDay: 2800,
    capacity: 300,
    sceneIndex: 1,
    thumbnail: '/scenes/crystal-ballroom-thumb.jpg',
    description: 'Modern ballroom with crystal chandeliers and panoramic windows.',
  },
  {
    id: 'conference-center',
    name: 'Conference Center',
    hotel: 'Hotel Africa',
    location: 'Tunis, Tunisia',
    dimensions: '20m × 35m',
    pricePerDay: 1800,
    capacity: 200,
    sceneIndex: 2,
    thumbnail: '/scenes/conference-center-thumb.jpg',
    description: 'Professional conference center with state-of-the-art AV equipment.',
  },
];
