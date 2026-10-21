from scraper.parser import count_pages

PAGER = """<div class="pager">
  <a href="/ru/results/tau_jarys_2026?d=105">1</a>
  <a href="/ru/results/tau_jarys_2026?d=105&Results_page=2">2</a>
  <a href="/ru/results/tau_jarys_2026?d=105&Results_page=14">Последняя</a>
</div>"""


def test_count_pages_ignores_category_id():
    # d=105 is the distance category, not a page number
    assert count_pages(PAGER) == 14


def test_count_pages_ignores_year_in_path():
    html = '<div class="pager"><a href="/ru/results/winter_run_2026?Results_page=3">3</a></div>'
    assert count_pages(html) == 3


def test_count_pages_without_pager():
    assert count_pages("<table></table>") == 1
