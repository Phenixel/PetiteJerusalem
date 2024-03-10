import requests
from .models import Gemara


def fetch_gemarot_from_api():
    url = "https://www.sefaria.org/api/index"
    params = {
        "category": "Talmud",
        "language": "he",  # Language of the Gemarot (Hebrew)
        # Other parameters as needed
    }

    response = requests.get(url, params=params)
    if response.status_code == 200:
        gemarot_data = response.json()
        for gemara_info in gemarot_data:
            gemara_name = gemara_info.get("title", "")
            gemara_link = gemara_info.get("url", "")
            # Créez un nouveau Gemara et enregistrez-le dans la base de données
            gemara, created = Gemara.objects.get_or_create(
                name=gemara_name,
                defaults={'available': True}
            )
            if created:
                gemara.save()
    else:
        print("Failed to fetch Gemarot from Sepharia API")
