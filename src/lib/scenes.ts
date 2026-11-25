// Shared 360° scene catalogue — the single source of truth for the scenes
// in the app. The editor (EVENT_SCENES), the Templates page and the
// "Choose Your Venue" popup all show these same 10 scenes, one template
// per scene.

export interface TemplateScene {
  label: string;
  src: string;
  dimensions: string;
  rentPrice: number;
}

export type SceneEventType = "Wedding" | "Conference" | "Gala Dinner";

// Polyhaven panoramas (same source the editor uses).
export const POLYHAVEN_BASE =
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG";

// Card photo for a scene, through Next.js' image optimizer. The width must
// be one of Next.js' allowed image widths — 800 is rejected with 400,
// 1080 is the closest allowed size for a card.
export const sceneThumb = (src: string) =>
  `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;

export interface SceneTemplate {
  eventType: SceneEventType;
  location: string;
  scene: TemplateScene;
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  // Wedding (3)
  { eventType: "Wedding", location: "Palais Royale", scene: { label: "Dancing Hall", src: `${POLYHAVEN_BASE}/dancing_hall.jpg`, dimensions: "25m x 40m", rentPrice: 1500 } },
  { eventType: "Wedding", location: "Palais Royale", scene: { label: "Music Hall", src: `${POLYHAVEN_BASE}/music_hall_02.jpg`, dimensions: "30m x 50m", rentPrice: 2200 } },
  { eventType: "Wedding", location: "Palais Royale", scene: { label: "Pillared Hall", src: `${POLYHAVEN_BASE}/solitude_interior.jpg`, dimensions: "20m x 30m", rentPrice: 1200 } },
  // Conference (4)
  { eventType: "Conference", location: "Convention Center", scene: { label: "Main Theater", src: `${POLYHAVEN_BASE}/theater_02.jpg`, dimensions: "40m x 60m", rentPrice: 3500 } },
  { eventType: "Conference", location: "Convention Center", scene: { label: "Stage Hall", src: `${POLYHAVEN_BASE}/theater_01.jpg`, dimensions: "35m x 45m", rentPrice: 2800 } },
  { eventType: "Conference", location: "Convention Center", scene: { label: "Lecture Hall", src: `${POLYHAVEN_BASE}/school_hall.jpg`, dimensions: "20m x 25m", rentPrice: 800 } },
  { eventType: "Conference", location: "Convention Center", scene: { label: "Screening Room", src: `${POLYHAVEN_BASE}/cinema_hall.jpg`, dimensions: "15m x 20m", rentPrice: 600 } },
  // Gala Dinner (3)
  { eventType: "Gala Dinner", location: "Grand Ballroom", scene: { label: "Grand Hall", src: `${POLYHAVEN_BASE}/old_hall.jpg`, dimensions: "45m x 70m", rentPrice: 4500 } },
  { eventType: "Gala Dinner", location: "Grand Ballroom", scene: { label: "Entrance Hall", src: `${POLYHAVEN_BASE}/entrance_hall.jpg`, dimensions: "15m x 30m", rentPrice: 1000 } },
  { eventType: "Gala Dinner", location: "Grand Ballroom", scene: { label: "Long Gallery", src: `${POLYHAVEN_BASE}/large_corridor.jpg`, dimensions: "10m x 80m", rentPrice: 1800 } },
];

/** The scene templates for one event type (3 Wedding, 4 Conference, 3 Gala Dinner). */
export function sceneTemplatesFor(eventType: string): SceneTemplate[] {
  return SCENE_TEMPLATES.filter((t) => t.eventType === eventType);
}
