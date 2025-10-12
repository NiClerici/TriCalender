let allTrainings = [];

// Startet erst, wenn das DOM aufgebaut wurde, damit der Trainings-Container vorhanden ist.
document.addEventListener("DOMContentLoaded", () => {
  fetch("../trainingskalender/trainings.json")
    .then((response) => response.json())
    .then((data) => {
      allTrainings = Array.isArray(data?.trainings) ? data.trainings : [];
      renderTrainings(allTrainings);
      wireSportFilter();
    })
    .catch((error) => {
      console.error("Fehler beim Laden der Trainingsdaten:", error);
    });
});

// Wandelt das Trainings-Array aus der JSON-Datei in Karten um.
function renderTrainings(data) {
  const container = document.getElementById("trainings");
  if (!container) {
    console.warn("Container mit der ID 'trainings' wurde nicht gefunden.");
    return;
  }

  const trainings = Array.isArray(data)
    ? data.slice()
    : Array.isArray(data?.trainings)
    ? data.trainings.slice()
    : [];
  // Gruppiert alle Trainings nach ISO-Kalenderwochen und sortiert chronologisch.
  const weeks = Object.values(groupByWeek(trainings)).sort((a, b) => {
    if (a.year === b.year) {
      return a.week - b.week;
    }
    return a.year - b.year;
  });

  container.innerHTML = "";
  container.classList.remove("training-grid");
  container.classList.add("training-weeks");

  const fragment = document.createDocumentFragment();

  // Rendert für jede Woche einen Abschnitt mit den zugehörigen Karten.
  weeks.forEach((weekGroup) => {
    const weekSection = document.createElement("section");
    weekSection.className = "week-group";

    const header = document.createElement("h3");
    header.className = "week-header";
    header.textContent = formatWeekHeader(weekGroup);
    weekSection.appendChild(header);

    const trainingsWrapper = document.createElement("div");
    trainingsWrapper.className = "week-trainings";

    weekGroup.trainings
      .slice()
      .sort(compareTrainings)
      .forEach((training) => {
        trainingsWrapper.appendChild(createTrainingCard(training));
      });

    weekSection.appendChild(trainingsWrapper);
    fragment.appendChild(weekSection);
  });

  container.appendChild(fragment);
}

function wireSportFilter() {
  const select = document.getElementById("sport-filter");
  if (!select) {
    return;
  }

  select.addEventListener("change", () => {
    const value = select.value;
    const filtered = filterBySport(allTrainings, value);
    renderTrainings(filtered);
  });
}

// Hilfsfunktion für Spans mit Klasse und Textinhalt.
function createSpan(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

// Baut den optionalen Block mit den Ist-Daten zusammen.
function createActualBlock(actual) {
    const block = document.createElement("div");
    block.className = "training-actual";

    const label = createSpan("training-actual-label", "Erledigt");
    const title = document.createElement("strong");
    title.className = "training-actual-title";
    title.textContent = actual.title;

    const details = document.createElement("span");
    details.className = "training-actual-details";
    const paceInfo = actual.pace_min_per_km_str
        ? ` · ${actual.pace_min_per_km_str}`
        : "";
    const roundedDuration = Math.round(actual.elapsed_time_min);
    details.textContent = `${roundedDuration} min ${paceInfo}`;
    block.append(label, title, details);
  return block;
}

// Baut eine Trainingskarte inklusive optionaler Strava-Verlinkung.
function createTrainingCard(training) {
  const card = document.createElement("article");
  card.className = "training-card";

  const header = document.createElement("div");
  header.className = "training-header";
  header.append(
    createSpan("training-date", training.date),
    createSpan("training-time", training.start_time)
  );
  card.appendChild(header);

  const title = document.createElement("h2");
  title.className = "training-title";
  title.textContent = training.title;
  card.appendChild(title);

  const sport = document.createElement("p");
  sport.className = "training-sport";
  sport.textContent = training.sport;
  card.appendChild(sport);

  if (training.actual) {
    card.appendChild(createActualBlock(training.actual));

    const stravaLink = document.createElement("a");
    stravaLink.className = "training-notes";
    stravaLink.href = `https://www.strava.com/activities/${training.actual.activity_id}`;
    stravaLink.textContent = "Strava Link";
    stravaLink.target = "_blank";
    stravaLink.rel = "noopener noreferrer";
    card.appendChild(stravaLink);
  }

  return card;
}

function getISOWeek(date){
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
    const week1 = new Date(tempDate.getFullYear(), 0, 3);
    return(
        1 +
        Math.round(
            ((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    );
}

function groupByWeek(trainings) {
    return trainings.reduce((acc, training) => {
    const date = new Date(training.date);
    const week = getISOWeek(date);
    const year = date.getFullYear();
    const key = `${year}-KW${week}`;
    if (!acc[key]) {
      acc[key] = { year, week, trainings: [] };
    }
    acc[key].trainings.push(training);
    return acc;
  }, {});
}

// Sortiert Trainings innerhalb einer Woche nach Datum und Startzeit.
function compareTrainings(a, b) {
  const dateA = new Date(`${a.date}T${a.start_time ?? "00:00"}`);
  const dateB = new Date(`${b.date}T${b.start_time ?? "00:00"}`);
  return dateA.getTime() - dateB.getTime();
}

// Erstellt den Wochenkopf (KW + Datumsrange) für den jeweiligen Abschnitt.
function formatWeekHeader({ year, week, trainings }) {
  if (!trainings.length) {
    return `KW ${week} ${year}`;
  }

  const dates = trainings
    .map((training) => new Date(training.date))
    .sort((a, b) => a.getTime() - b.getTime());

  const start = dates[0];
  const end = dates[dates.length - 1];

  const formatDayMonth = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  };

  const startLabel = formatDayMonth(start);
  const endLabel = formatDayMonth(end);

  const sameYear = start.getFullYear() === end.getFullYear();
  const yearLabel = sameYear
    ? start.getFullYear()
    : `${start.getFullYear()} / ${end.getFullYear()}`;

  const rangeLabel =
    startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;

  return `KW ${week} · ${rangeLabel} ${yearLabel}`;
}

function filterBySport(trainings, sport) {
  if (!sport) return trainings;
  const sports = Array.isArray(sport) ? sport.map(s => s.toLowerCase().trim()) : [sport.toLowerCase().trim()];
  return trainings.filter(training => {
    const entrySport = training?.sport?.toLowerCase().trim();
    return entrySport && sports.includes(entrySport);
  });
}
