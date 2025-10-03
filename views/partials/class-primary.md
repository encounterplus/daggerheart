#### {{'Class.Domains'|l}}

{% for domain in data.domains -%}[{{domain|map: 'Domain'}}](domain), {% endfor %}

#### {{'Class.StartingEvasion'|l}}

{{data.evasion|default: '-'}}

#### {{'Class.StartingHitPoints'|l}}

{{data.hp|default: '-'}}

#### {{'Class.ClassItems'|l}}

{{data.items|default: '-'}}

#### {{'Class.HopeFeature'|l}}

***{{data.hopeFeature.name}}:*** {{data.hopeFeature.text}}

#### {{'Class.ClassFeatures'|l}}

{% for feature in data.features -%}
###### {{feature.name}}
{{feature.text}}
{% endfor %}