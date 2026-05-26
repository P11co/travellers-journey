import { create } from 'zustand';

/**
 * Global app store using Zustand.
 * Manages itinerary state that flows across the entire user journey.
 */
const useAppStore = create((set, get) => ({
  // ── Itineraries ──────────────────────────────────────────────
  itineraries: [],

  addItinerary: (itinerary) => {
    const id = Date.now().toString();
    const createdAt = new Date().toISOString();

    set((state) => ({
      itineraries: [
        ...state.itineraries,
        {
          id,
          createdAt,
          ...itinerary,
        },
      ],
    }));

    return id;
  },

  removeItinerary: (id) =>
    set((state) => ({
      itineraries: state.itineraries.filter((it) => it.id !== id),
    })),

  // ── Active tour session ──────────────────────────────────────
  activeTourId: null,

  startTour: (id) => set({ activeTourId: id }),
  endTour: () => set({ activeTourId: null }),

  getActiveItinerary: () => {
    const { itineraries, activeTourId } = get();
    return itineraries.find((it) => it.id === activeTourId) || null;
  },

  // ── Draft (plan-your-journey in progress) ────────────────────
  draft: {
    primaryLocation: 'Gyeongbokgung Palace',
    budgetLevel: 'Standard',
    availableTime: 'Full Day (8 hrs)',
    activities: {
      mmca: false,
      detailedPalace: true,
      kyobo: false,
      hanok: true,
    },
    stops: [
      {
        name: 'Gyeongbokgung Palace',
        time: '09:00 AM',
        description: 'Start your day exploring the largest of the Five Grand Palaces...',
        duration: '2.5 hours',
        tags: ['Walking'],
        image: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=500',
      },
      {
        name: 'Bukchon Hanok Village',
        time: '11:45 AM',
        description: 'A short walk from the palace. Wander through hundreds of traditional houses...',
        duration: '1.5 hours',
        tags: ['Photography'],
        image: null,
      },
      {
        name: 'Lunch in Insadong',
        time: '13:15 PM',
        description: 'Enjoy authentic Korean cuisine in the heart of Seoul\'s traditional cultural district.',
        duration: '1 hour',
        tags: ['TOP CHOICE', 'TRADITIONAL'],
        isLunch: true,
      },
      {
        name: 'N Seoul Tower',
        time: '15:00 PM',
        description: 'Head up Namsan Mountain for panoramic city views...',
        duration: '2 hours',
        tags: ['Scenic'],
        image: 'https://images.unsplash.com/photo-1578637387939-43c525550085?w=500',
      },
    ],
  },

  updateDraft: (updates) =>
    set((state) => ({
      draft: { ...state.draft, ...updates },
    })),

  toggleDraftActivity: (key) =>
    set((state) => ({
      draft: {
        ...state.draft,
        activities: {
          ...state.draft.activities,
          [key]: !state.draft.activities[key],
        },
      },
    })),

  finalizeDraft: () => {
    const { draft, addItinerary } = get();
    return addItinerary({
      name: `${draft.primaryLocation} Tour`,
      location: `${draft.primaryLocation}, Seoul`,
      duration: draft.availableTime,
      stops: draft.stops,
      stopCount: draft.stops.length,
    });
  },
}));

export default useAppStore;
