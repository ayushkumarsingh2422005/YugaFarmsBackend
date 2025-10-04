import type { Schema, Struct } from '@strapi/strapi';

export interface AddressAddress extends Struct.ComponentSchema {
  collectionName: 'components_address_addresses';
  info: {
    displayName: 'address';
  };
  attributes: {
    AddressLine1: Schema.Attribute.String & Schema.Attribute.Required;
    AddressLine2: Schema.Attribute.String;
    City: Schema.Attribute.String & Schema.Attribute.Required;
    Pin: Schema.Attribute.Integer & Schema.Attribute.Required;
    State: Schema.Attribute.Enumeration<
      [
        'Andhra Pradesh',
        'Arunachal Pradesh',
        'Assam',
        'Bihar',
        'Chhattisgarh',
        'Goa',
        'Gujarat',
        'Haryana',
        'Himachal Pradesh',
        'Jharkhand',
        'Karnataka',
        'Kerala',
        'Madhya Pradesh',
        'Maharashtra',
        'Manipur',
        'Meghalaya',
        'Mizoram',
        'Nagaland',
        'Odisha',
        'Punjab',
        'Rajasthan',
        'Sikkim',
        'Tamil Nadu',
        'Telangana',
        'Tripura',
        'Uttar Pradesh',
        'Uttarakhand',
        'West Bengal',
      ]
    > &
      Schema.Attribute.Required;
  };
}

export interface ProductVariantProductVariant extends Struct.ComponentSchema {
  collectionName: 'components_product_variant_product_variants';
  info: {
    displayName: 'ProductVariant';
  };
  attributes: {
    Discount: Schema.Attribute.Integer;
    Price: Schema.Attribute.Integer;
    Stock: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    Weight: Schema.Attribute.Integer;
  };
}

export interface TagTag extends Struct.ComponentSchema {
  collectionName: 'components_tag_tags';
  info: {
    displayName: 'Tag';
  };
  attributes: {
    Value: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'address.address': AddressAddress;
      'product-variant.product-variant': ProductVariantProductVariant;
      'tag.tag': TagTag;
    }
  }
}
