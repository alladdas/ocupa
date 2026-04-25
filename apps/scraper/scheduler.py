import logging
import schedule
import time
from scrapers.gupy import scrape_gupy
from scrapers.greenhouse import scrape_greenhouse
from scrapers.alterlab import scrape_alterlab
from scrapers.amazon import scrape_amazon

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


def run_daily() -> None:
    """Amazon + AlterLab run once per day."""
    logger.info('── Daily run started ────────────────────────')
    try:
        amazon_new = scrape_amazon()
        logger.info(f'Amazon     → {amazon_new} new jobs')
    except Exception as exc:
        logger.error(f'Amazon failed: {exc}')

    try:
        alterlab_new = scrape_alterlab()
        logger.info(f'AlterLab   → {alterlab_new} new jobs')
    except Exception as exc:
        logger.error(f'AlterLab failed: {exc}')

    logger.info('── Daily run finished ───────────────────────')


if __name__ == '__main__':
    logger.info('Scheduler starting')

    run_frequent()  # Run immediately on startup
    run_daily()     # Run daily scrapers once on startup too

    schedule.every(30).minutes.do(run_frequent)
    schedule.every().day.at('06:00').do(run_daily)

    while True:
        schedule.run_pending()
        time.sleep(60)
