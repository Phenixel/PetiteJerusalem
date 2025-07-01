document.addEventListener('DOMContentLoaded', function () {
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    var cardBodies = document.querySelectorAll('.card-body');
    cardBodies.forEach(function (cardBody) {
        cardBody.addEventListener('click', function () {
            var perekList = cardBody.querySelector('.perek-list');
            var collapseIcon = cardBody.querySelector('.collapse-icon');
            if (perekList && perekList.style.display === "none") {
                perekList.style.display = "block";
                collapseIcon.style.display = "block";
            }
        });

        var collapseIcon = cardBody.querySelector('.collapse-icon');
        collapseIcon.addEventListener('click', function (event) {
            event.stopPropagation(); // Prevent the card body click event
            var perekList = cardBody.querySelector('.perek-list');
            if (perekList) {
                perekList.style.display = "none";
                collapseIcon.style.display = "none";
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

function toggleMainCheckbox(id) {
    var mainCheckbox = document.getElementById("text_study_" + id);
    var perekList = document.getElementById("perek_list_" + id);
    var checkboxes = perekList.querySelectorAll("input[type='checkbox']");
    var allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);

    mainCheckbox.checked = allChecked;
}

document.addEventListener('DOMContentLoaded', function () {
    var shareModal = document.getElementById('shareModal');
    shareModal.addEventListener('shown.bs.modal', function () {
        var qrcodeContainer = document.getElementById('qrcode');
        qrcodeContainer.innerHTML = '';
        new QRCode(qrcodeContainer, {
            text: window.location.href,
            width: 256,
            height: 256
        });
    });
});