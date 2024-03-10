import requests
import logging
from .models import Gemarot

logger = logging.getLogger(__name__)


def fetch_gemarot_from_api():
    url = "https://www.sefaria.org/api/index"
    params = {
        "category": "Talmud",
        "language": "he",  # Langue des Gemarot (Hébreu)
        # Autres paramètres si nécessaire
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()  # Lève une exception en cas de code HTTP différent de 200
        gemarot_data = response.json()

        gemarot_to_create = []
        for gemara_info in gemarot_data:
            gemara_name = gemara_info.get("title", "").strip()  # Nettoie le nom de la Gemara
            gemara_link = gemara_info.get("url", "")
            gemarot_to_create.append(Gemarot(name=gemara_name, link=gemara_link))

        # Créez les objets Gemarot en une seule requête à la base de données
        Gemarot.objects.bulk_create(gemarot_to_create)

        logger.info("Gemarot fetched successfully and saved to the database.")
    except requests.RequestException as e:
        logger.error(f"Failed to fetch Gemarot from Sepharia API: {e}")
    except Exception as ex:
        logger.exception("An error occurred while fetching Gemarot:")
