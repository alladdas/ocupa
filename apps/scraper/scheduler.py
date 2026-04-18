import logging
import schedule
import time
from scrapers.gupy import scrape_gupy
from scrapers.greenhouse import scrape_greenhouse

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)


def run_all() -> None:
    logger.info('── Scraper run started ──────────────────────')
    try:
        gupy_new = scrape_gupy()
        logger.info(f'Gupy       → {gupy_new} new jobs')
    except Exception as exc:
        logger.error(f'Gupy failed: {exc}')
        gupy_new = 0

    try:
        greenhouse_new = scrape_greenhouse()
        logger.info(f'Greenhouse → {greenhouse_new} new jobs')
    except Exception as exc:
        logger.error(f'Greenhouse failed: {exc}')
        greenhouse_new = 0

    total = gupy_new + greenhouse_new
    logger.info(f'── Total: {total} new jobs inserted ─────────')


if __name__ == '__main__':
    logger.info('Scheduler starting — interval: 30 minutes')
    run_all()  # Run immediately on startup

    schedule.every(30).minutes.do(run_all)

    while True:
        schedule.run_pending()
        time.sleep(60)
