import pytest

from scraper.names import city_key, display_city, fold, name_key


@pytest.mark.parametrize("a, b", [
    ("Двоянов Александр", "Dvoyanov Alexandr"),
    ("Сергей Иванов", "Ivanov Sergey"),          # order + й/y
    ("Ермек Санжар", "Sanzhar Yermek"),            # Ye/E
    ("Даниил Петров", "Petrov Danil"),             # double letters
    ("Жуванов Артур", "Zhuvanov Artur"),
    ("Иванов Иван Иванович", "Ivanov Ivan"),       # patronymic ignored
    ("Хасенов Нурлан", "Khassenov Nurlan"),
])
def test_same_person_same_key(a, b):
    assert name_key(a) == name_key(b)


@pytest.mark.parametrize("a, b", [
    ("Ivanov Ivan", "Petrov Ivan"),
    ("Juvanov Artur", "Uvanov Artur"),
])
def test_different_people_different_keys(a, b):
    assert name_key(a) != name_key(b)


def test_single_token_has_no_key():
    assert name_key("Team") is None
    assert name_key("") is None


@pytest.mark.parametrize("raw, display", [
    ("Almaty", "Алматы"), ("ALMATY", "Алматы"), ("Алмата", "Алматы"),
    ("Nur-Sultan", "Астана"), ("Oskemen", "Усть-Каменогорск"),
    ("Kostanay", "Костанай"), ("Shymkent", "Шымкент"), ("Moscow", "Москва"),
    ("Yakutsk", "Якутск"), ("Shchuchinsk", "Щучинск"),
    ("Saint Petersburg", "Санкт-Петербург"),
    ("Somewhere", "Somewhere"), ("", ""), (None, ""),
])
def test_display_city(raw, display):
    assert display_city(raw) == display


def test_city_key_matches_cyrillic_and_latin():
    assert city_key("Алматы") == city_key("Almaty")
    assert city_key("Талдыкорган") == city_key("Taldykorgan")


def test_fold_is_idempotent_enough():
    assert fold("Aleksandr") == fold("Alexandr") == fold("Александр")
