export type ImportantDate = {
  dueString: string;
  due: Date;
  name: string;
  details: string;
};

export const importantDates: ImportantDate[] = [
  {
    name: "Regalo Eterno",
    dueString: "20 DICIEMBRE",
    due: new Date("2025-12-20"),
    details: "Celebración especial de Navidad.",
  },
  {
    name: "Congreso Movimiento Jóvenes",
    dueString: "14 al 18 ENERO",
    due: new Date("2026-01-18"),
    details: "Campamento de formación y avivamiento.",
  },
  {
    name: "Nuevo evento",
    due: new Date("2026-02-20"),
    dueString: "Próximamente",
    details: "Mantente atento a nuestras redes sociales.",
  },
];

export const isPastDate = (date: Date, reference: Date): boolean =>
  date.getTime() < reference.getTime();

export const getFeaturedIndex = (
  dates: ImportantDate[],
  reference: Date,
): number => {
  let featuredIndex: number | null = null;
  let smallestDiff = Number.POSITIVE_INFINITY;

  dates.forEach((date, index) => {
    const diff = date.due.getTime() - reference.getTime();

    if (diff >= 0 && diff < smallestDiff) {
      smallestDiff = diff;
      featuredIndex = index;
    }
  });

  if (featuredIndex !== null) {
    return featuredIndex;
  }

  let latestIndex = 0;
  let latestTime = Number.NEGATIVE_INFINITY;

  dates.forEach((date, index) => {
    const time = date.due.getTime();

    if (time > latestTime) {
      latestTime = time;
      latestIndex = index;
    }
  });

  return latestIndex;
};


