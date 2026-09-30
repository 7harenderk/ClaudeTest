# MealFlow — meal planner & tracker (front end)

Static HTML/CSS/JS, no build step. Open `meal-planner/index.html` in a browser and pick a design:

| Option | Look |
|---|---|
| `option-1-garden.html` | Sidebar dashboard, fresh greens (closest to the reference screen) |
| `option-2-spice.html` | Warm ivory + terracotta, big meal cards for the day |
| `option-3-midnight.html` | Dark command-centre, live plan panel on the right |

All three share `mealflow.js` (data + rotation engine) and `mealflow.css` (components).
Plans, custom meals and "eaten" ticks are saved in the browser's localStorage.

- Dates run 28 Sep 2026 – 30 Jun 2027; today is highlighted with 2 days either side.
- Click a board cell to book a meal (Lunch/Dinner dishes ask which slot); ＋ Add meal / ✕ remove (with Undo).
- **Suggest / ↻ / Auto-plan 7 days** rotate meals: longest-since-last-had first, no same dish family on neighbouring days, non-veg spaced out, winter sabzis only Nov–Feb.
