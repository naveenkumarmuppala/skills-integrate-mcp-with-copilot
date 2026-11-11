document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const searchInput = document.getElementById("activity-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortSelect = document.getElementById("activity-sort");
  const resultsCount = document.getElementById("activity-results");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  let activitiesData = {};

  const weekdays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  function getScheduleOrder(schedule) {
    const normalizedSchedule = schedule.toLowerCase();
    const dayIndex = weekdays.findIndex((day) =>
      new RegExp(`\\b${day}s?\\b`).test(normalizedSchedule)
    );
    const timeMatch = schedule.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);

    if (!timeMatch) {
      return [dayIndex < 0 ? weekdays.length : dayIndex, Number.MAX_SAFE_INTEGER];
    }

    let hours = Number(timeMatch[1]) % 12;
    if (timeMatch[3].toUpperCase() === "PM") {
      hours += 12;
    }

    return [
      dayIndex < 0 ? weekdays.length : dayIndex,
      hours * 60 + Number(timeMatch[2] || 0),
    ];
  }

  function renderActivities() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortBy = sortSelect.value;

    const matchingActivities = Object.entries(activitiesData)
      .filter(([name, details]) => {
        const matchesCategory = !selectedCategory || details.category === selectedCategory;
        const searchableText = [
          name,
          details.description,
          details.schedule,
          details.category,
        ]
          .join(" ")
          .toLowerCase();

        return matchesCategory && searchableText.includes(searchTerm);
      })
      .sort(([nameA, detailsA], [nameB, detailsB]) => {
        if (sortBy === "name") {
          return nameA.localeCompare(nameB);
        }

        const [dayA, timeA] = getScheduleOrder(detailsA.schedule);
        const [dayB, timeB] = getScheduleOrder(detailsB.schedule);
        return dayA - dayB || timeA - timeB || nameA.localeCompare(nameB);
      });

    activitiesList.innerHTML = "";
    resultsCount.textContent = `Showing ${matchingActivities.length} of ${Object.keys(activitiesData).length} activities`;

    if (matchingActivities.length === 0) {
      activitiesList.innerHTML = "<p>No activities match these filters.</p>";
      return;
    }

    matchingActivities.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;
      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : "<p><em>No participants yet</em></p>";

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p class="activity-category">${details.category}</p>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  }

  function populateActivityOptions() {
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    Object.keys(activitiesData).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });

    const categories = [...new Set(Object.values(activitiesData).map((activity) => activity.category))]
      .filter(Boolean)
      .sort((categoryA, categoryB) => categoryA.localeCompare(categoryB));

    categoryFilter.innerHTML = '<option value="">All categories</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      activitiesData = await response.json();
      populateActivityOptions();
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  searchInput.addEventListener("input", renderActivities);
  categoryFilter.addEventListener("change", renderActivities);
  sortSelect.addEventListener("change", renderActivities);

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
