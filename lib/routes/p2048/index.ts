import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import type { DataItem } from '@/types';

export const route: Route = {
    path: '/:section?',
    name: '2048 论坛',
    url: 'hjd2048.com',
    maintainers: ['leothronton'],
    example: '/p2048/1',
    parameters: { section: '板块 ID，默认为 1' },
    handler: async (ctx) => {
        const { section = '1' } = ctx.req.param();
        const baseUrl = 'https://hjd2048.com';
        const url = `${baseUrl}/thread0806.php?fid=${section}`;

        const response = await ofetch(url);
        const $ = load(response);

        const items: DataItem[] = $('.tr3.t_one')
            .slice(0, 20)
            .toArray()
            .map((el) => {
                const $el = $(el);
                const titleEl = $el.find('.subject .tal a');
                const title = titleEl.text();
                const link = baseUrl + titleEl.attr('href');
                const pubDate = $el.find('a > span').attr('title');

                return {
                    title,
                    link,
                    pubDate,
                } as DataItem;
            });

        return {
            title: `2048 论坛 - 板块 ${section}`,
            link: url,
            item: items,
        };
    },
};
