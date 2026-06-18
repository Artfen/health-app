import type { Part } from './types';

const part: Part = {
  en: {
    sleep: {
      subtitle: 'Recovery and sleep quality',
      lastNightHrv: 'Last night HRV',
      status: {
        BALANCED: 'Balanced',
        LOW: 'Low',
        UNBALANCED: 'Unbalanced',
        POOR: 'Poor',
      },
      stagesTitle: 'Sleep stages',
      lastNights_one: 'Last night',
      lastNights_other: 'Last {count} nights',
      legend: {
        deep: 'Deep',
        rem: 'REM',
        light: 'Light',
      },
      emptyTitle: 'No sleep data yet',
      emptyDesc: 'Sync your Garmin from the dashboard to see sleep data.',
    },
  },
  fr: {
    sleep: {
      subtitle: 'Récupération et qualité du sommeil',
      lastNightHrv: 'HRV de la nuit dernière',
      status: {
        BALANCED: 'Équilibré',
        LOW: 'Faible',
        UNBALANCED: 'Déséquilibré',
        POOR: 'Mauvais',
      },
      stagesTitle: 'Phases de sommeil',
      lastNights_one: 'Dernière nuit',
      lastNights_other: 'Les {count} dernières nuits',
      legend: {
        deep: 'Profond',
        rem: 'REM',
        light: 'Léger',
      },
      emptyTitle: 'Aucune donnée de sommeil',
      emptyDesc: 'Synchronisez votre Garmin depuis le tableau de bord pour voir les données de sommeil.',
    },
  },
  es: {
    sleep: {
      subtitle: 'Recuperación y calidad del sueño',
      lastNightHrv: 'HRV de anoche',
      status: {
        BALANCED: 'Equilibrado',
        LOW: 'Bajo',
        UNBALANCED: 'Desequilibrado',
        POOR: 'Malo',
      },
      stagesTitle: 'Fases del sueño',
      lastNights_one: 'Última noche',
      lastNights_other: 'Últimas {count} noches',
      legend: {
        deep: 'Profundo',
        rem: 'REM',
        light: 'Ligero',
      },
      emptyTitle: 'Aún no hay datos de sueño',
      emptyDesc: 'Sincroniza tu Garmin desde el panel para ver los datos de sueño.',
    },
  },
  de: {
    sleep: {
      subtitle: 'Erholung und Schlafqualität',
      lastNightHrv: 'HRV letzte Nacht',
      status: {
        BALANCED: 'Ausgeglichen',
        LOW: 'Niedrig',
        UNBALANCED: 'Unausgeglichen',
        POOR: 'Schlecht',
      },
      stagesTitle: 'Schlafphasen',
      lastNights_one: 'Letzte Nacht',
      lastNights_other: 'Letzte {count} Nächte',
      legend: {
        deep: 'Tief',
        rem: 'REM',
        light: 'Leicht',
      },
      emptyTitle: 'Noch keine Schlafdaten',
      emptyDesc: 'Synchronisiere dein Garmin vom Dashboard, um Schlafdaten zu sehen.',
    },
  },
};

export default part;
