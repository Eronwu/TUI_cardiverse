use serde_json::{json, Map, Value};

pub fn normalize_card_value(mut value: Value) -> Value {
    normalize_object(&mut value);
    value
}

fn normalize_object(value: &mut Value) {
    let Value::Object(object) = value else {
        return;
    };

    normalize_kind(object);
    normalize_target(object, "target");
    normalize_duration(object);
    normalize_trigger(object);
    normalize_effects(object);

    if !object.contains_key("id") {
        object.insert("id".into(), json!(""));
    }
    if !object.contains_key("tags") {
        object.insert("tags".into(), json!([]));
    }
}

fn normalize_kind(object: &mut Map<String, Value>) {
    if let Some(kind) = object
        .get("kind")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        let normalized = match kind.as_str() {
            "attack_card" | "spell" | "damage" => "attack",
            "persistent" | "summon" => "daemon",
            "trap" | "counter" => "kernel",
            other => other,
        };
        object.insert("kind".into(), json!(normalized));
    }
}

fn normalize_effects(object: &mut Map<String, Value>) {
    let Some(Value::Array(effects)) = object.get_mut("effects") else {
        return;
    };

    for effect in effects {
        let Value::Object(effect_object) = effect else {
            continue;
        };
        if let Some(effect_type) = effect_object
            .get("type")
            .and_then(Value::as_str)
            .map(str::to_string)
        {
            let normalized = match effect_type.as_str() {
                "attack" | "burn" | "destroy" => "damage",
                "restore" => "heal",
                "armor" | "barrier" => "shield",
                "ram" => "gain_ram",
                other => other,
            };
            effect_object.insert("type".into(), json!(normalized));
        }
        normalize_track(effect_object);
        default_missing_track(effect_object);
        normalize_amount(effect_object);
        normalize_target(effect_object, "target");
    }
}

fn normalize_duration(object: &mut Map<String, Value>) {
    let Some(duration) = object.get("duration").cloned() else {
        return;
    };
    match duration {
        Value::String(value) => {
            let normalized = value.trim().to_lowercase();
            if matches!(
                normalized.as_str(),
                "instant" | "instantaneous" | "none" | "null" | "once" | "single" | "one-shot"
            ) {
                object.remove("duration");
                return;
            }
            if let Ok(turns) = normalized.parse::<u8>() {
                object.insert("duration".into(), json!(turns));
                return;
            }
            object.remove("duration");
        }
        Value::Number(number) => {
            if let Some(turns) = number.as_u64() {
                object.insert("duration".into(), json!(turns.clamp(1, 4)));
            } else {
                object.remove("duration");
            }
        }
        Value::Null => {
            object.remove("duration");
        }
        _ => {
            object.remove("duration");
        }
    }
}

fn normalize_trigger(object: &mut Map<String, Value>) {
    let Some(trigger) = object.get("trigger").cloned() else {
        return;
    };
    match trigger {
        Value::Object(_) => {}
        Value::String(value) => {
            let normalized = value.trim().to_lowercase();
            if matches!(
                normalized.as_str(),
                "instant" | "instantaneous" | "none" | "null" | "on_play" | "on play"
            ) {
                object.remove("trigger");
            } else if object.get("kind").and_then(Value::as_str) == Some("kernel") {
                object.insert(
                    "trigger".into(),
                    json!({
                        "when": "self_takes_sanity_damage",
                        "limit": 1
                    }),
                );
            } else {
                object.remove("trigger");
            }
        }
        Value::Null => {
            object.remove("trigger");
        }
        _ => {
            object.remove("trigger");
        }
    }
}

fn normalize_track(object: &mut Map<String, Value>) {
    let Some(track) = object
        .get("track")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        return;
    };
    let normalized = match track.as_str() {
        "health" | "life" | "fire" | "thermal" | "physical" => "hp",
        "mind" | "logic" | "paradox" | "mental" => "sanity",
        other => other,
    };
    object.insert("track".into(), json!(normalized));
}

fn default_missing_track(object: &mut Map<String, Value>) {
    if object.contains_key("track") {
        return;
    }
    let effect_type = object.get("type").and_then(Value::as_str);
    if matches!(effect_type, Some("damage" | "heal" | "shield")) {
        object.insert("track".into(), json!("hp"));
    }
}

fn normalize_amount(object: &mut Map<String, Value>) {
    if object.contains_key("amount") {
        return;
    }
    for alias in ["value", "power", "damage", "heal", "shield"] {
        if let Some(value) = object.remove(alias) {
            object.insert("amount".into(), value);
            return;
        }
    }
}

fn normalize_target(object: &mut Map<String, Value>, key: &str) {
    let Some(target) = object.get(key).and_then(Value::as_str).map(str::to_string) else {
        return;
    };
    let normalized = match target.as_str() {
        "player" | "me" | "self_actor" | "ally" => "self",
        "opponent" | "boss" | "foe" | "target" => "enemy",
        other => other,
    };
    object.insert(key.into(), json!(normalized));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_common_third_party_aliases() {
        let value = json!({
            "kind": "spell",
            "name": "Fire Angel",
            "description": "burn",
            "target": "opponent",
            "duration": "instant",
            "cost": 9,
            "effects": [{ "type": "attack", "track": "fire", "value": 20 }]
        });
        let normalized = normalize_card_value(value);
        assert_eq!(normalized["kind"], "attack");
        assert_eq!(normalized["target"], "enemy");
        assert_eq!(normalized["effects"][0]["type"], "damage");
        assert_eq!(normalized["effects"][0]["track"], "hp");
        assert_eq!(normalized["effects"][0]["amount"], 20);
        assert!(normalized.get("duration").is_none());
    }

    #[test]
    fn converts_numeric_duration_strings() {
        let value = json!({
            "kind": "daemon",
            "name": "Shield Loop",
            "description": "guard",
            "duration": "3",
            "effects": [{ "type": "shield", "track": "health", "amount": 10, "target": "me" }]
        });
        let normalized = normalize_card_value(value);
        assert_eq!(normalized["duration"], 3);
    }

    #[test]
    fn defaults_missing_track_for_track_based_effects() {
        let value = json!({
            "kind": "attack",
            "name": "Void Hammer",
            "description": "hit",
            "effects": [{ "type": "damage", "amount": 12 }]
        });
        let normalized = normalize_card_value(value);
        assert_eq!(normalized["effects"][0]["track"], "hp");
    }

    #[test]
    fn drops_instant_trigger_strings() {
        let value = json!({
            "kind": "attack",
            "name": "Fire Angel",
            "description": "burn",
            "trigger": "instant",
            "effects": [{ "type": "damage", "amount": 12 }]
        });
        let normalized = normalize_card_value(value);
        assert!(normalized.get("trigger").is_none());
    }
}
