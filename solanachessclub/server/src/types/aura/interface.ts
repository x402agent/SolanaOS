export interface GetAssetsByOwnerParams {
    ownerAddress: string;
    sortBy?: 'created' | 'updated' | 'recent_action';
    limit?: number;
    page?: number;
    before?: string;
    after?: string;
}
export interface GetAssetsByAuthorityParams {
    authorityAddress: string;
    sortBy?: 'created' | 'updated' | 'recent_action';
    limit?: number;
    page?: number;
    before?: string;
    after?: string;
}
export interface GetAssetsByGroupParams {
    groupKey: string;
    groupValue: string;
    sortBy?: 'created' | 'updated' | 'recent_action';
    limit?: number;
    page?: number;
    before?: string;
    after?: string;
}
export interface GetAssetsByCreatorParams {
    creatorAddress: string;
    onlyVerified?: boolean;
    sortBy?: 'created' | 'updated' | 'recent_action';
    limit?: number;
    page?: number;
    before?: string;
    after?: string;
}
export interface GetSignaturesForAssetParams {
    id: string;
    page?: number;
    limit?: number;
    before?: string;
    after?: string;
}
export interface GetTokenAccountsParams {
    mint?: string;
    owner?: string;
    limit?: number;
    page?: number;
    cursor?: string;
    before?: string;
    after?: string;
    showZeroBalance?: boolean;
}
export interface ArrayKeyValuePair {
    key: string;
    value: string;
}

export interface SearchAssetsParams {
    negate?: boolean;
    matchType?: 'all' | 'any';
    interface?: 'V1_NFT' | 'V1_PRINT' | 'LEGACY_NFT' | 'V2_NFT' | 'FungibleAsset' | 'Custom' | 'Identity' | 'Executable';
    ownerAddress?: string;
    ownerType?: string;
    creatorAddress?: string;
    creatorVerified?: boolean;
    authorityAddress?: string;
    grouping?: ArrayKeyValuePair[];
    delegate?: string;
    frozen?: boolean;
    supply?: number;
    supplyMint?: string;
    compressed?: boolean;
    compressible?: boolean;
    royaltyTargetType?: string;
    burnt?: boolean;
    sortBy?: 'created' | 'updated' | 'recent_action';
    limit?: number;
    page?: number;
    before?: string;
    after?: string;
    jsonUri?: string;
}

export interface GetAssetProofParams {
    id: string;
}

export interface GetAssetsByBatchParams {
    assetIds: string[];
}

export interface GetAssetProofBatchParams {
    assetIds: string[];
}