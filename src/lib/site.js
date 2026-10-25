// Конфиг текущего сайта (sites/<SITE>/site.json) + производные значения.
import site from '@site/site.json';

export const phoneHref = 'tel:' + site.contacts.phone.replace(/[^\d+]/g, '');
export const mailHref = 'mailto:' + site.contacts.email;
export default site;
