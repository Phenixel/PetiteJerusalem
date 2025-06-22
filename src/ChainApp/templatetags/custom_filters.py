from django import template

register = template.Library()

@register.filter
def all_reserved(sections):
    return all(section['reserved'] for section in sections)


@register.filter
def unique_names(sections):
    seen = set()
    unique = []
    for section in sections:
        if section['chosen_by_username'] not in seen:
            unique.append(section['chosen_by_username'])
            seen.add(section['chosen_by_username'])
    return unique

@register.filter
def any_reserved(sections):
    return any(section['reserved'] for section in sections)