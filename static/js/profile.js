document.addEventListener('DOMContentLoaded', function () {
    var editSessionModal = document.getElementById('editSessionModal');
    editSessionModal.addEventListener('show.bs.modal', function (event) {
        var button = event.relatedTarget;
        var sessionId = button.getAttribute('data-session-id');
        var sessionName = button.getAttribute('data-session-name');
        var sessionDescription = button.getAttribute('data-session-description');
        var sessionDate = button.getAttribute('data-session-date');

        var modalTitle = editSessionModal.querySelector('.modal-title');
        var sessionIdInput = editSessionModal.querySelector('#editSessionId');
        var sessionNameInput = editSessionModal.querySelector('#editSessionName');
        var sessionDescriptionInput = editSessionModal.querySelector('#editSessionDescription');
        var sessionDateInput = editSessionModal.querySelector('#editSessionDate');

        modalTitle.textContent = 'Modifier la session ' + sessionName;
        sessionIdInput.value = sessionId;
        sessionNameInput.value = sessionName;
        sessionDescriptionInput.value = sessionDescription;
        sessionDateInput.value = sessionDate;
    });

    document.getElementById('editSessionForm').addEventListener('submit', function (event) {
        event.preventDefault();
        var sessionId = document.getElementById('editSessionId').value;
        var sessionName = document.getElementById('editSessionName').value;
        var sessionDescription = document.getElementById('editSessionDescription').value;
        var sessionDate = document.getElementById('editSessionDate').value;

        fetch(`/update-session/${sessionId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: new URLSearchParams({
                'name': sessionName,
                'description': sessionDescription,
                'date_limit': sessionDate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                alert(data.error);
            }
        });
    });
});

function deleteSession(sessionId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette session ?')) {
        fetch(`/delete-session/${sessionId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                alert('Erreur lors de la suppression de la session.');
            }
        });
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function confirmReading(reservationId) {
    fetch(`/confirm-reading/${reservationId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Find the button and update its appearance
            const button = document.querySelector(`button[onclick="confirmReading(${reservationId})"]`);
            button.classList.remove('btn-outline-success');
            button.classList.add('btn-success');
            button.innerHTML = '<i class="fas fa-check"></i> Lu';
            button.disabled = true;
        } else {
            alert('Erreur lors de la confirmation de la lecture.');
        }
    });
}