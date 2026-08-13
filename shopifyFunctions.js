const axios = require('axios');

async function shopifyGraphQL(query, variables) {
    const response = await axios.post(
        process.env.GRAPHQL_URL,
        JSON.stringify({ query, variables }),
        {
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
            }
        }
    );

    return response.data.data;
}

async function getLocationId() {
    const data = await shopifyGraphQL(`
        query {
            locations(first: 10) {
                nodes {
                    id
                    name
                }
            }
        }
    `);

    return data.locations.nodes[0].id;
}

async function getProductsByVendor(cursor, vendor) {
    const data = await shopifyGraphQL(`
        query {
            products(first: 100, ${cursor ? `after: "${cursor}",` : ''} query: "vendor:${vendor} status:active") {
                pageInfo { hasNextPage endCursor }
                nodes {
                    handle
                    title
                    variants(first: 150) {
                        nodes {
                            title
                            sku
                            inventoryQuantity
                            inventoryItem {
                                id
                            }
                        }
                    }
                }
            }
        }
    `);

    return data.products;
}

async function paginateProductsByVendor(vendorName) {
    const products = [];
    let cursor = null;
    let hasNext = true;

    while (hasNext) {
        const page = await getProductsByVendor(cursor, vendorName);
        products.push(...page.nodes);
        hasNext = page.pageInfo.hasNextPage;
        cursor = page.pageInfo.endCursor;
    }

    return products;
}

async function updateInventory(input) {
    const idempotencyKey = crypto.randomUUID();
    const data = await shopifyGraphQL(`
        mutation InventorySet($input: InventorySetQuantitiesInput!) {
            inventorySetQuantities(input: $input) @idempotent(key: "${idempotencyKey}") {
                inventoryAdjustmentGroup {
                    changes {
                        delta
                        name
                    }
                }
                userErrors {
                    message
                    field
                }
            }
        }
    `, { input });

    return data.inventorySetQuantities.inventoryAdjustmentGroup;
}

module.exports = { getLocationId, paginateProductsByVendor, updateInventory };
