{% if data.spellcastTrait %}
#### {{'Subclass.SpellcastTrait'|l}}
{{data.spellcastTrait|map: 'Trait'}}
{% endif %}

#### {{'Subclass.FoundationFeatures'|l}}

{% for feature in data.foundations %}
***{{feature.name}}:*** {{feature.text}}
{% endfor %}

#### {{'Subclass.SpecializationFeatures'|l}}

{% for feature in data.specializations %}
***{{feature.name}}:*** {{feature.text}}
{% endfor %}

#### {{'Subclass.MasteryFeatures'|l}}

{% for feature in data.masteries %}
***{{feature.name}}:*** {{feature.text}}
{% endfor %}