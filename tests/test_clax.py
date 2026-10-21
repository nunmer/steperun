from datetime import date

from scraper.athletex import clax_links, year_variants
from scraper.clax import (
    category_label, parse_clax, parse_event_date, parse_page_date, parse_serial_date, parse_time,
)

SAMPLE = """<?xml version="1.0" encoding="utf-8"?>
<Epreuve nom="TEST TRAIL 2026" dates="воскресенье, 6 сентября 2026 г.">
  <IP><I id="0" nm="№ выдан" /><I id="3" nm="Город." /></IP>
  <Pays><p n="KAZ" i="KZ" l="Казахстан" /><p n="RUS" i="RU" l="Россия" /></Pays>
  <Parcours>
    <Pcs nom="Long Trail" distance="39900" />
    <Pcs nom="21.1 km" distance="21000" />
    <Pcs nom="Kids 1 km" distance="1000" />
    <Pcs nom="Bike Ultra" distance="0" />
  </Parcours>
  <Etapes><Etape>
    <Engages>
      <E d="1" n="Slow Runner" p="Long Trail" na="KAZ" ip0="yes" ip3="Almaty" />
      <E d="2" n="Fast Runner" p="Long Trail" na="RUS" ip3="Moscow" />
      <E d="3" n="Quit Early" p="Long Trail" na="KAZ" />
      <E d="4" n="Half Runner" p="21.1 km" na="KAZ" />
      <E d="5" n="Little Kid" p="Kids 1 km" na="KAZ" />
      <E d="6" n="Bike Person" p="Bike Ultra" na="KAZ" />
    </Engages>
    <Resultats>
      <R d="1" t="05h00'13,194" p0="02h10'00" p1="03h40'00" />
      <R d="2" t="04h01'02" />
      <R d="3" t="Сошёл" tr="4" />
      <R d="4" t="01h30'05" />
      <R d="5" t="00h05'00" />
      <R d="6" t="03h00'00" />
      <R d="99" t="01h00'00" />
    </Resultats>
  </Etape></Etapes>
</Epreuve>""".encode("utf-8")


def test_parse_time():
    assert parse_time("01h39'16") == "01:39:16"
    assert parse_time("00h04'03,7") == "00:04:03.7"
    assert parse_time("27h00'01") == "27:00:01"
    assert parse_time("Сошёл") is None
    assert parse_time(None) is None


def test_parse_event_date():
    assert parse_event_date("воскресенье, 6 сентября 2026 г.") == date(2026, 9, 6)
    assert parse_event_date("") is None
    assert parse_event_date("31 февраля 2026") is None


def test_category_labels_align_with_existing_road_labels():
    assert category_label("21.1 km", 21000) == "21 км 97,5 м"
    assert category_label("10 km", 10000) == "10 км"
    assert category_label("Nordic 10 km", 10000) == "Скандинавская ходьба: 10 км"
    assert category_label("42.2 km", 42195) == "42 км 195 м"
    assert category_label("Irbis Race", 39900) == "Irbis Race 39.9 км"
    assert category_label("Trail 25", 0) == "Trail 25"
    assert category_label("Run 10 km", 10000) == "10 км"
    assert category_label("Run 21.1 km", 21100) == "21 км 97,5 м"


def test_category_skips_non_running():
    for course in ("Bike Ultra", "ITT MTB", "ITT Road", "DUO", "Relay 21.1",
                   "Kids 2 km", "Canicross", "Zamykaiushiy", "Oi-Qaragai (дети)",
                   "Teen 2", "Virtual run", "Виртуальный забег", "Vertical Race (skimo) 1.5 км",
                   "Splitboard/Skitour 7 км", "Snowshoeing 4 км", "test",
                   "Team 5", "Open Team 10", "Elite Team 5", "Командный забег"):
        assert category_label(course, 0) is None, course


def test_parse_clax_results_places_and_fields():
    ev = parse_clax(SAMPLE)
    assert ev.name == "Test Trail 2026"
    assert ev.event_date == date(2026, 9, 6)

    by_bib = {r.bib: r for r in ev.results}
    assert set(by_bib) == {"1", "2", "4"}  # DNF, kid, bike, unknown bib dropped

    fast, slow = by_bib["2"], by_bib["1"]
    assert (fast.place, slow.place) == (1, 2)  # place recomputed from time
    assert fast.country == "Russia" and fast.city == "Moscow"
    assert slow.city == "Almaty"  # city comes from the field labelled "Город", not ip0
    assert slow.chip_time == "05:00:13.194"
    assert slow.checkpoint_times == ("02:10:00", "03:40:00")
    assert by_bib["4"].distance_category == "21 км 97,5 м"
    assert by_bib["4"].place == 1


def test_year_variants():
    assert year_variants("IrbisRace2026", range(2024, 2027)) == ["IrbisRace2024", "IrbisRace2025"]
    assert year_variants("rrautumn26", [2025]) == ["rrautumn25"]
    assert year_variants("arakbulak", [2025]) == []


def test_clax_links():
    html = ('<a href="https://live.myrace.info/?f=bases/kz/2026/irbis2026/air2026.clax">x</a>'
            '<a href="https://live.myrace.info/?f=bases/kz/2026/irbis2026/air2026.clax">y</a>')
    assert clax_links(html) == [("bases/kz/2026/irbis2026/air2026.clax", 2026, "irbis2026")]


def test_parse_serial_date():
    assert parse_serial_date("45346") == date(2024, 2, 24)
    assert parse_serial_date("46235") == date(2026, 8, 1)
    assert parse_serial_date("") is None
    assert parse_serial_date("12") is None      # out of range
    assert parse_serial_date("abc") is None


def test_parse_page_date():
    assert parse_page_date("<p>Старт 12 октября 2025 в 9:00</p>") == date(2025, 10, 12)
    assert parse_page_date("Дата: 20.06.2026") == date(2026, 6, 20)
    assert parse_page_date("no date here") is None
    assert parse_page_date(None) is None


def test_parse_clax_falls_back_to_serial_date():
    xml = SAMPLE.replace('dates="воскресенье, 6 сентября 2026 г."'.encode(), b'dates="" date="45346"')
    assert parse_clax(xml).event_date == date(2024, 2, 24)
