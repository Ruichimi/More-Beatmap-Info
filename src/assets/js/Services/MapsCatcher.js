class MapsCatcher {
    constructor() {
        this.data = [];
        this.isMutation = false;
    }

    initializeObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (!this.isMutation && mutation.target.classList.contains('beatmapsets__items')) {
                    const newIds = this.getMapsIds();

                    if (!this.arraysAreEqual(this.data, newIds)) {
                        this.data = newIds;
                        this.updateData();
                    }
                }
            });
        });

        const targetNode = document.querySelector('.beatmapsets__items');

        if (targetNode) {
            observer.observe(targetNode, { childList: true });
        }
    }

    updateData() {
        console.log('Вызван updateData');
        console.log(this.data);
    }

    getMapsIds() {
        let elements = document.querySelectorAll('.beatmapset-panel__main-link.u-ellipsis-overflow');
        let elementsArray = Array.from(elements);
        let filteredElementsArray = elementsArray.filter((element, index) => index % 2 === 0);

        return filteredElementsArray.map(element => {
            let id;
            let href = element.getAttribute('href');
            let match = href.match(/\/(\d+)$/);
            id = match ? match[1] : null;

            if (!this.isMutation) {
                this.isMutation = true;
                element.innerText = id;
                this.isMutation = false;
            }

            return id;
        });
    }

    arraysAreEqual(arr1, arr2) {
        return JSON.stringify(arr1) === JSON.stringify(arr2);
    }
}

export default new MapsCatcher();
