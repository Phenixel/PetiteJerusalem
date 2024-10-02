from django import template

register = template.Library()

@register.filter
def all_reserved(sections):
    return all(section['reserved'] for section in sections)
