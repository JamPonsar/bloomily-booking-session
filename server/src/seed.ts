import type { DatabaseSync } from 'node:sqlite';
import { newId } from './ids.ts';

export const DEMO_PARENT_ID = 'par_demo';

/** Deterministic PRNG so every fresh database looks the same. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO timestamp for `dayOffset` days from today at a local hour/minute. */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function birthdate(age: number, monthsPast: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(d.getMonth() - monthsPast);
  return d.toISOString().slice(0, 10);
}

interface Program {
  title: string;
  description: string;
  lead: string;
  category: string;
  location: string;
  minAge: number;
  maxAge: number;
  priceCents: number;
  capacity: number;
}

const PROGRAMS = {
  robotics: { title: 'Junior Robotics Lab', description: 'Build and program a small rover with block-based code. Teams of two.', lead: 'Mr. Daniel Osei', category: 'stem', location: 'Maker Room', minAge: 7, maxAge: 12, priceCents: 3500, capacity: 10 },
  dancers: { title: 'Tiny Dancers', description: 'Creative movement and simple choreography set to storybook music.', lead: 'Ms. Rosa Alvarez', category: 'music', location: 'Dance Studio', minAge: 3, maxAge: 6, priceCents: 1500, capacity: 12 },
  soccer: { title: 'Soccer Skills Clinic', description: 'Dribbling, passing and small-sided games focused on fun and teamwork.', lead: 'Coach Luis Herrera', category: 'sports', location: 'North Field', minAge: 6, maxAge: 12, priceCents: 2200, capacity: 16 },
  watercolor: { title: 'Little Picassos: Watercolor', description: 'Wet-on-wet techniques, color mixing and a take-home painting. Smocks provided.', lead: 'Ms. Hannah Cole', category: 'art', location: 'Studio A', minAge: 5, maxAge: 9, priceCents: 2500, capacity: 12 },
  drums: { title: 'Rhythm & Drums', description: 'Hand drums, shakers and call-and-response rhythm games.', lead: 'Ms. Rosa Alvarez', category: 'music', location: 'Music Hall', minAge: 4, maxAge: 8, priceCents: 1800, capacity: 14 },
  garden: { title: 'Garden Explorers', description: 'Plant seedlings, hunt for bugs and learn how gardens grow. Dress for mud!', lead: 'Mr. Felix Moreau', category: 'nature', location: 'Community Garden', minAge: 5, maxAge: 10, priceCents: 2000, capacity: 15 },
  clay: { title: 'Clay & Sculpture', description: 'Pinch pots, coil building and glazing basics.', lead: 'Ms. Hannah Cole', category: 'art', location: 'Studio B', minAge: 7, maxAge: 12, priceCents: 3000, capacity: 10 },
  snack: { title: 'Mini Chefs: Snack Lab', description: 'A quick after-school cook-along: wash up, chop, mix and eat what you make.', lead: 'Chef Imani Brooks', category: 'cooking', location: 'Teaching Kitchen', minAge: 6, maxAge: 11, priceCents: 2800, capacity: 8 },
  pizza: { title: 'Mini Chefs: Pizza Party', description: 'Knead dough, choose toppings and bake personal pizzas. Dietary needs accommodated.', lead: 'Chef Imani Brooks', category: 'cooking', location: 'Teaching Kitchen', minAge: 6, maxAge: 11, priceCents: 4000, capacity: 8 },
  cookies: { title: 'Little Bakers: Cookies', description: 'Measure, mix and decorate sugar cookies to share.', lead: 'Chef Imani Brooks', category: 'cooking', location: 'Teaching Kitchen', minAge: 5, maxAge: 10, priceCents: 3500, capacity: 8 },
  games: { title: 'Movement & Games', description: 'Relay races, parachute games and a good wiggle out after a long day at school.', lead: 'Coach Luis Herrera', category: 'sports', location: 'Gym', minAge: 5, maxAge: 9, priceCents: 1500, capacity: 16 },
  story: { title: 'Story & Craft Hour', description: 'A picture book read-aloud followed by a simple craft to take home.', lead: 'Ms. Hannah Cole', category: 'art', location: 'Library Nook', minAge: 4, maxAge: 7, priceCents: 1200, capacity: 12 },
  stars: { title: 'Starlight Science Night', description: 'Build a pocket planetarium and peek through real telescopes.', lead: 'Dr. Mei Tanaka', category: 'stem', location: 'Observatory Deck', minAge: 8, maxAge: 14, priceCents: 2800, capacity: 20 },
} satisfies Record<string, Program>;

type Key = keyof typeof PROGRAMS;

/**
 * Weekly timetable, [program, startHour, startMinute, minutes]. Weekdays run after
 * school (3:45–6 pm, 45–75 min, because school fills the day and young kids tire);
 * weekends are busier and start mid-morning.
 */
const WEEK: Record<number, Array<[Key, number, number, number]>> = {
  0: [['garden', 9, 30, 90], ['dancers', 10, 0, 60], ['watercolor', 11, 0, 90], ['drums', 12, 30, 60], ['cookies', 14, 0, 120]],
  1: [['dancers', 15, 45, 45], ['robotics', 16, 0, 75]],
  2: [['soccer', 16, 0, 60], ['watercolor', 16, 30, 60]],
  3: [['drums', 16, 0, 60], ['garden', 16, 15, 75]],
  4: [['clay', 16, 15, 75], ['snack', 16, 30, 75]],
  5: [['story', 15, 45, 60], ['games', 16, 0, 60]],
  6: [['soccer', 9, 0, 90], ['dancers', 9, 30, 60], ['robotics', 10, 30, 120], ['pizza', 11, 30, 120], ['clay', 13, 0, 120]],
};

const FIRST = ['Anika', 'Dev', 'Zoe', 'Max', 'Lily', 'Kai', 'Ada', 'Tobi', 'Freya', 'Noah', 'Ivy', 'Eli', 'Maya', 'Omar', 'Sofia', 'Jonah', 'Nora', 'Theo', 'Amara', 'Luca', 'Hana', 'Ezra', 'Priya', 'Finn'];
const FAMILIES: Array<[string, string]> = [
  ['Priya', 'Shah'], ['Marcus', 'Bell'], ['Elena', 'Kovacs'], ['Tom', 'Nguyen'], ['Aisha', 'Okafor'], ['Ben', 'Larsen'],
  ['Carla', 'Mendez'], ['David', 'Cho'], ['Rachel', 'Adler'], ['Sam', 'Patel'], ['Grace', 'Murphy'], ['Hiro', 'Tanaka'],
];
const DIETS = [[], [], [], [], ['Nut allergy'], ['Vegetarian'], ['Dairy-free'], ['Gluten-free'], ['Egg allergy'], ['Halal'], ['Gluten-free', 'Nut allergy']];

export function seed(db: DatabaseSync): void {
  const rand = rng(20261018);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const now = new Date().toISOString();

  const insertParent = db.prepare(`
    INSERT INTO parents (id, first_name, last_name, email, phone, address, emergency_contact_name, emergency_contact_phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertChild = db.prepare(`
    INSERT INTO children (id, parent_id, first_name, last_name, date_of_birth, dietary_restrictions, medical_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertSession = db.prepare(`
    INSERT INTO sessions (id, title, description, instructor_name, category, location, starts_at, ends_at, capacity, min_age, max_age, price_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertBooking = db.prepare(`
    INSERT INTO bookings (id, session_id, child_id, parent_id, status, consent_shared_at, created_at)
    VALUES (?, ?, ?, ?, 'confirmed', ?, ?)`);

  // The signed-in demo parent.
  insertParent.run(DEMO_PARENT_ID, 'Jordan', 'Rivera', 'jordan.rivera@example.com', '(555) 201-4432',
    '42 Willow Lane, Portland, OR', 'Sam Rivera', '(555) 201-9981', now, now);
  const mia = newId('chd');
  const leo = newId('chd');
  insertChild.run(mia, DEMO_PARENT_ID, 'Mia', 'Rivera', birthdate(6, 3), JSON.stringify(['Vegetarian']), 'Mild asthma — inhaler in backpack', now, now);
  insertChild.run(leo, DEMO_PARENT_ID, 'Leo', 'Rivera', birthdate(9, 7), JSON.stringify([]), '', now, now);

  // Other families so rosters look realistic.
  const kids: Array<{ id: string; parentId: string; age: number }> = [];
  let nameIdx = 0;
  FAMILIES.forEach(([first, last], i) => {
    const parentId = newId('par');
    insertParent.run(parentId, first, last, `${first}.${last}@example.com`.toLowerCase(), `(555) 300-10${String(i).padStart(2, '0')}`,
      `${100 + i * 7} Maple St, Portland, OR`, '', '', now, now);
    const count = rand() < 0.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const id = newId('chd');
      const age = 3 + Math.floor(rand() * 10);
      insertChild.run(id, parentId, FIRST[nameIdx++ % FIRST.length], last, birthdate(age, 1 + Math.floor(rand() * 10)), JSON.stringify(pick(DIETS)), '', now, now);
      kids.push({ id, parentId, age });
    }
  });

  // Sessions: one week back through four weeks ahead, following the weekly timetable.
  interface Made { id: string; key: Key; start: Date; capacity: number; minAge: number; maxAge: number; daysOut: number }
  const made: Made[] = [];
  const startMonday = new Date();
  startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7));
  startMonday.setHours(0, 0, 0, 0);

  for (let daysOut = -7; daysOut <= 27; daysOut++) {
    const day = at(daysOut, 0);
    const slots = [...(WEEK[day.getDay()] ?? [])];
    // A special family evening on every other Saturday.
    const weekIndex = Math.floor((day.getTime() - startMonday.getTime()) / (7 * 86_400_000));
    if (day.getDay() === 6 && weekIndex % 2 === 0) slots.push(['stars', 18, 30, 90]);

    for (const [key, h, m, minutes] of slots) {
      const p: Program = PROGRAMS[key];
      const start = at(daysOut, h, m);
      const end = new Date(start.getTime() + minutes * 60_000);
      const id = newId('ses');
      insertSession.run(id, p.title, p.description, p.lead, p.category, p.location, start.toISOString(), end.toISOString(),
        p.capacity, p.minAge, p.maxAge, p.priceCents, now);
      made.push({ id, key, start, capacity: p.capacity, minAge: p.minAge, maxAge: p.maxAge, daysOut });
    }
  }

  // Fill rosters: past sessions mostly full, near-term busier than far-future, weekends busier than weekdays.
  // Bookings are always made in the past; roughly one in five was made within the last 24 h
  // so staff can see both locked and unlocked family details.
  const book = (sessionId: string, childId: string, parentId: string, when: Date, createdAt?: Date) => {
    const ceiling = Math.min(when.getTime(), Date.now());
    const recent = when.getTime() > Date.now() && rand() < 0.2;
    const created = (createdAt ?? new Date(recent ? Date.now() - (1 + rand() * 22) * 3_600_000 : ceiling - (1.2 + rand() * 6) * 86_400_000)).toISOString();
    insertBooking.run(newId('bkg'), sessionId, childId, parentId, created, created);
  };
  for (const s of made) {
    const weekend = s.start.getDay() === 0 || s.start.getDay() === 6;
    const base = s.daysOut < 0 ? 0.75 : Math.max(0.2, 0.7 - s.daysOut * 0.02);
    const fill = Math.min(0.95, base * (weekend ? 1.15 : 0.9) * (0.7 + rand() * 0.5));
    const eligible = kids
      .filter((k) => k.age >= s.minAge && k.age <= s.maxAge)
      .sort(() => rand() - 0.5);
    const target = Math.min(eligible.length, Math.round(s.capacity * fill));
    eligible.slice(0, target).forEach((c) => book(s.id, c.id, c.parentId, s.start));
  }

  // The demo parent: a couple of past bookings plus a few coming up.
  const nextOf = (key: Key, nth = 0) => made.filter((s) => s.key === key && s.daysOut >= 0 && s.start.getTime() > Date.now())[nth];
  const lastOf = (key: Key) => made.filter((s) => s.key === key && s.start.getTime() < Date.now()).at(-1);
  const demo: Array<[Made | undefined, string]> = [
    [lastOf('watercolor'), mia], [lastOf('soccer'), leo],
    [nextOf('garden'), mia], [nextOf('robotics'), leo], [nextOf('pizza'), leo], [nextOf('story', 1), mia],
  ];
  const justNow = new Date(Date.now() - 3 * 3_600_000);
  demo.forEach(([s, childId], i) => {
    if (s) book(s.id, childId, DEMO_PARENT_ID, s.start, i === demo.length - 1 ? justNow : undefined);
  });
}
