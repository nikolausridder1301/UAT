// Supabase-Zugangsdaten
// Diese Werte findest du in deinem Supabase-Projekt unter:
// Project Settings -> API Keys -> Project URL / Publishable key
// Der "Publishable key" ist bewusst öffentlich nutzbar (kein Geheimnis) -
// der eigentliche Schutz läuft über Row Level Security (RLS) in Supabase.
// NIEMALS den "Secret key" hier eintragen - der ist nur für Server-Code gedacht.

const SUPABASE_URL = "https://cwonqyonwuxaryotcsms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VwvZYi5QR0pjn5m_3nEsrA_SnBPet-9";

// Namen für das Dropdown "Reported by". Einfach hier ergänzen/ändern.
const TEAM_NAMES = [
  "Nikolaus Ridder",
  "Jens Semmer",
  "Prateek Jain",
  "Ruiyan Zhu",
  "Ulrich Martin",
  "Sascha Schiele",
  "Leonie Krause",
  "Pascal Pechstein",
  "Robin Teichmann",
  "Emily Carnall",
  "Huriyyah Dhanse",
  "Mohan Achar",
  "Christopher Keil",
  "Maik Sauerbier",
];

// Namen für das Dropdown "Loops Owner" - nur das Loops-Team.
const LOOPS_OWNERS = ["Emily Carnall", "Huriyyah Dhanse", "Mohan Achar", "Prateek Jain", "Ruiyan Zhu"];

// Auswahlmöglichkeiten für das Feld "Agent". Aktuell nur "COM",
// weitere Module/Systeme können hier einfach ergänzt werden.
const AGENT_OPTIONS = ["COM"];
