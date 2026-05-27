import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/:id?',
    name: '板块订阅',
    url: 'hjd2048.com',
    maintainers: ['leothronton'],
    categories: ['forum'],
    example: '/p2048/3',
    parameters: {
        id: '板块 ID，默认为 3',
    },
    handler: async (ctx) => {
        const { id = '3' } = ctx.req.param();
        const baseUrl = 'https://hjd2048.com';
        const page = ctx.req.query('page') ?? '1';

        const listUrl = `${baseUrl}/thread.php?fid=${id}&page=${page}`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: `${baseUrl}/`,
        };

        const response = await ofetch(listUrl, { headers });
        const $ = load(response);
        const rows = $('tr')
            .toArray()
            .filter((el) => $(el).find('a.subject').length > 0);

        if (rows.length === 0) {
            return { title: `hjd2048 - 板块 ${id}`, link: listUrl, item: [] };
        }

        const items = await Promise.all(
            rows.map(async (el) => {
                const $row = $(el);
                const linkEl = $row.find('a.subject');
                const title = linkEl.text().trim();
                const href = linkEl.attr('href') ?? '';
                const fullLink = href.startsWith('http') ? href : `${baseUrl}/${href}`;

                const author = $row.find('a.bl').text().trim() || '未知用户';
                const dateText = $row.find('.tal.y-style span.f10.gray').text().trim() || $row.find('.f10.gray-').text().trim();
                const pubDate = dateText ? timezone(parseDate(dateText), 8) : undefined;

                // 抓取正文
                const description = await cache.tryGet(fullLink, async () => {
                    try {
                        const postRes = await ofetch(fullLink, { headers });
                        const $post = load(postRes);
                        const contentEl = $post('#message, .t_f, .postmessage, .content').first();
                        const html = contentEl.length ? contentEl.html() : '';

                        if (html) {
                            const $doc = load(html);
                            $doc('img').each((_, imgEl) => {
                                let src = $doc(imgEl).attr('src') || $doc(imgEl).attr('data-src');
                                if (src) {
                                    if (!src.startsWith('http') && !src.startsWith('data:')) {
                                        src = `${baseUrl}/${src.replace(/^\//, '')}`;
                                    }
                                    $doc(imgEl).attr('src', src);
                                }
                            });
                            return $doc.html();
                        }
                    } catch {
                        // 失败时记录日志
                    }
                    return;
                });

                const imgEl = $row.find('td.tal img, a.subject img').first();
                const rawImg = imgEl.attr('data-src') || imgEl.attr('src');
                const enclosure = rawImg
                    ? {
                          url: rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg}`,
                          type: 'image/jpeg',
                      }
                    : undefined;

                return {
                    title,
                    link: fullLink,
                    author,
                    pubDate,
                    description: description || title,
                    enclosure,
                };
            })
        );

        return {
            title: `hjd2048 - 板块 ${id}`,
            link: `${baseUrl}/thread.php?fid=${id}`,
            item: items,
        };
    },
};
