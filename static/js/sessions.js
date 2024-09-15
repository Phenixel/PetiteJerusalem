// Initialisation du popover
document.addEventListener('DOMContentLoaded', function () {
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Ajout des gestionnaires d'événements pour chaque card-body
    var cardBodies = document.querySelectorAll('.card-body');
    cardBodies.forEach(function (cardBody) {
        cardBody.addEventListener('click', function () {
            var perekList = cardBody.querySelector('.perek-list');
            if (perekList) {
                if (perekList.style.display === "none") {
                    perekList.style.display = "block";
                } else {
                    perekList.style.display = "none";
                }
            }
        });
    });
});

function togglePerekSelection(id, isChecked) {
    var perekList = document.getElementById("perek_list_" + id);
    var checkboxes = perekList.querySelectorAll("input[type='checkbox']");

    checkboxes.forEach(function (checkbox) {
        if (!checkbox.disabled) {
            checkbox.checked = isChecked;
        }
    });
}