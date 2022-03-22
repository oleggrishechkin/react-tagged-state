// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'React Tagged State',
    tagline: '⚛️ Experimental reactive and atomic state manager',
    url: 'https://github.com/oleggrishechkin/react-tagged-state',
    baseUrl: '/react-tagged-state/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon:
        'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚛️</text></svg>',
    organizationName: 'oleggrishechkin', // Usually your GitHub org/user name.
    projectName: 'react-tagged-state', // Usually your repo name.

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    sidebarPath: require.resolve('./sidebars.js'),
                    // Please change this to your repo.
                    editUrl: 'https://github.com/oleggrishechkin/react-tagged-state/website'
                },
                theme: {
                    customCss: require.resolve('./src/css/custom.css')
                }
            })
        ]
    ],

    themeConfig:
        /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            navbar: {
                title: 'React Tagged State',
                logo: {
                    alt: 'React Tagged State Logo',
                    src: 'img/logo.png'
                },
                items: [
                    {
                        type: 'doc',
                        docId: 'intro',
                        position: 'left',
                        label: 'Tutorial'
                    },
                    {
                        href: 'https://github.com/oleggrishechkin/react-tagged-state',
                        label: 'GitHub',
                        position: 'right'
                    }
                ]
            },
            footer: {
                style: 'dark',
                links: [
                    {
                        title: 'Docs',
                        items: [
                            {
                                label: 'Tutorial',
                                to: '/docs/intro'
                            }
                        ]
                    },

                    {
                        title: 'More',
                        items: [
                            {
                                label: 'GitHub',
                                href: 'https://github.com/oleggrishechkin/react-tagged-state'
                            }
                        ]
                    }
                ],
                copyright: `Copyright © ${new Date().getFullYear()} React Tagged State, Inc. Built with Docusaurus.`
            },
            prism: {
                theme: lightCodeTheme,
                darkTheme: darkCodeTheme
            }
        })
};

module.exports = config;
