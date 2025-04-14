function mountTestField() {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.color = "black";
    container.style.top = "10px";
    container.style.right = "10px";
    container.style.background = "white";
    container.style.border = "1px solid #ccc";
    container.style.padding = "10px";
    container.style.zIndex = "999999";
    container.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    container.style.borderRadius = "8px";
    container.style.fontFamily = "sans-serif";

    const label = document.createElement("label");
    label.textContent = "Remove beatmapset by ID:";
    container.appendChild(label);
    container.appendChild(document.createElement("br"));

    const input = document.createElement("input");
    input.type = "number";
    input.style.color = "black";
    input.style.width = "150px";
    input.placeholder = "e.g. 1393879";
    container.appendChild(input);

    const button = document.createElement("button");
    button.textContent = "Remove";
    button.style.color = "black";
    button.style.marginLeft = "8px";
    container.appendChild(button);

    button.addEventListener("click", () => {
        const id = input.value.trim();
        if (!id || isNaN(Number(id))) {
            alert("Please enter a valid numeric ID.");
            return;
        }

        const fullKey = "beatmapset_" + id;

        try {
            const key = "beatmapsetsCache";
            const raw = localStorage.getItem(key);
            if (!raw) {
                alert("beatmapsetsCache not found.");
                return;
            }

            const obj = JSON.parse(raw);
            if (typeof obj !== "object" || obj === null) {
                alert("beatmapsetsCache is not an object.");
                return;
            }

            if (obj[fullKey]) {
                delete obj[fullKey];
                localStorage.setItem(key, JSON.stringify(obj));
                alert(`Removed beatmapset with key "${fullKey}".`);
            } else {
                alert(`No entry with key "${fullKey}" found.`);
            }
        } catch (e) {
            alert("Error: " + e.message);
        }
    });

    document.body.appendChild(container);
}

export default mountTestField;
