interface ImportantDate {
   dueString: string;
   due: Date;
   name: string;
   details: string;
}

const importantDates: ImportantDate[] = [
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

const isPastDate = (date: Date, reference: Date): boolean => {
   return date.getTime() < reference.getTime();
};

const getFeaturedIndex = (dates: ImportantDate[], reference: Date): number => {
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

export const renderImportantDates = (): void => {
   const sectionImportantDates = document.querySelector<HTMLDivElement>(".important-dates-grid");

   if (!sectionImportantDates) {
      return;
   }

   const currentDate = new Date();
   const sortedDates = [...importantDates].sort((a, b) => a.due.getTime() - b.due.getTime());

   const featuredIndex = getFeaturedIndex(sortedDates, currentDate);

   sortedDates.forEach((date, index) => {
      const dateCard = document.createElement("article");
      dateCard.classList.add("date-card");

      if (index === featuredIndex) {
         dateCard.classList.add("date-card-featured");
      }

      if (isPastDate(date.due, currentDate) && index !== featuredIndex) {
         dateCard.classList.add("is-past");
      }

      dateCard.innerHTML = `
         <h3>${date.dueString}</h3>
         <p class="date-name">${date.name}</p>
         <p class="date-detail">${date.details}</p>
      `;

      sectionImportantDates.appendChild(dateCard);
   });
};
