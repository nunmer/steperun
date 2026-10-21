from scraper.runner_matcher import RunnerIndex


def make_index(rows):
    index = RunnerIndex()
    for rid, name, country, city in rows:
        index.add(rid, name, country, city)
    return index


def test_matches_cyrillic_existing_runner():
    index = make_index([(1, "Двоянов Александр", "Kazakhstan", "Кокшетау")])
    assert index.match("Dvoyanov Alexandr", "Kazakhstan", "Kokshetau") == 1


def test_blank_city_or_country_still_matches_single_candidate():
    index = make_index([(1, "Ivanov Ivan", "Kazakhstan", "Алматы")])
    assert index.match("Иван Иванов", "", "") == 1


def test_different_city_does_not_match():
    index = make_index([(1, "Ivanov Ivan", "Kazakhstan", "Алматы")])
    assert index.match("Ivanov Ivan", "Kazakhstan", "Astana") is None


def test_different_country_does_not_match():
    index = make_index([(1, "Ivanov Ivan", "Kazakhstan", "")])
    assert index.match("Ivanov Ivan", "Russia", "") is None


def test_ambiguous_name_without_city_creates_new():
    index = make_index([
        (1, "Ivanov Ivan", "Kazakhstan", "Алматы"),
        (2, "Ivanov Ivan", "Kazakhstan", "Астана"),
    ])
    assert index.match("Ivanov Ivan", "Kazakhstan", "") is None


def test_ambiguous_name_resolved_by_city():
    index = make_index([
        (1, "Ivanov Ivan", "Kazakhstan", "Алматы"),
        (2, "Ivanov Ivan", "Kazakhstan", "Астана"),
        (3, "Ivanov Ivan", "", ""),
    ])
    assert index.match("Ivanov Ivan", "Kazakhstan", "Almaty") == 1


def test_unknown_runner():
    index = make_index([(1, "Petrov Petr", "Kazakhstan", "Алматы")])
    assert index.match("Ivanov Ivan", "Kazakhstan", "Almaty") is None
