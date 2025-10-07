// Startet erst, wenn das DOM aufgebaut wurde, damit der Trainings-Container vorhanden ist.
document.addEventListener("DOMContentLoaded", () => {
  fetch("../trainingskalender/trainings.json")
    .then((response) => response.json())
    .then((data) => renderTrainings(data))
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

  container.classList.add("training-grid");

  data.trainings.forEach((t) => {
    const card = document.createElement("article");
    card.className = "training-card";

    const header = document.createElement("div");
    header.className = "training-header";
    header.append(
      createSpan("training-date", t.date),
      createSpan("training-time", t.start_time)
    );
    card.appendChild(header);

    const title = document.createElement("h2");
    title.className = "training-title";
    title.textContent = t.title;
    card.appendChild(title);

    const sport = document.createElement("p");
    sport.className = "training-sport";
    sport.textContent = t.sport;
    card.appendChild(sport);

    

    if (t.actual) {
      card.appendChild(createActualBlock(t.actual));
      
        const stravaLink = document.createElement("a");
        stravaLink.className = "training-notes";
        stravaLink.href = `https://www.strava.com/activities/${t.actual.activity_id}`;
        stravaLink.textContent = "Strava Link";
        stravaLink.target = '_blank';
        stravaLink.rel = 'noopener noreferrer';
        card.appendChild(stravaLink);
    }

    container.appendChild(card);
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

