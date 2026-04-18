import logging
import schedule
import time
from scrapers.gupy import scrape_gupy
from scrapers.greenhouse import scrape_greenhouse
from scrapers.alterlab import scrape_alterlab

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)


def run_frequent() -> None:
    """Gupy + Greenhouse run every 30 minutes."""
    logger.info('── Frequent run started ─────────────────────')
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


def run_alterlab() -> None:
    """AlterLab runs once per day (API credits cost money)."""
    logger.info('── AlterLab run started ─────────────────────')
    try:
        new = scrape_alterlab()
        logger.info(f'AlterLab   → {new} new jobs')
    except Exception as exc:
        logger.error(f'AlterLab failed: {exc}')
    logger.info('── AlterLab run finished ────────────────────')


if __name__ == '__main__':
    logger.info('Scheduler starting')

    run_frequent()   # Run immediately on startup
    run_alterlab()   # Run AlterLab once on startup too

    schedule.every(30).minutes.do(run_frequent)
    schedule.every().day.at('06:00').do(run_alterlab)

    while True:
        schedule.run_pending()
        time.sleep(60)
