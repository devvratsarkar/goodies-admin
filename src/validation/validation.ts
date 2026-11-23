import * as Yup from "yup";

const SAFE_TEXT = /^[\p{L}\p{M}\p{N}\s.,?'’\-:،؟]+$/u;
const SCRIPT_PATTERN = /<|>|javascript:|onerror\s*=|onload\s*=/i;

export const requiredString = (required: string, max: number) =>
  Yup.string()
    .trim()
    .required(required)
    .max(max, "tooLong")
    .matches(SAFE_TEXT, "invalidText")
    .test("no-script", "invalidText", (value) => !value || !SCRIPT_PATTERN.test(value));
export const phoneString = (required: string, phoneInvalid: string) => Yup.string().trim().required(required).matches(/^[+]?[\d\s()-]{7,20}$/, phoneInvalid);
export const emailString = (required: string, emailInvalid: string) => Yup.string().trim().required(required).email(emailInvalid);

const requiredNumber = (label: string) =>
  Yup.number()
    .typeError(`${label} is required`)
    .required(`${label} is required`)

const requiredPrice = (label: string) =>
  requiredNumber(label).moreThan(0, `${label} must be greater than 0`)

const sellingPriceNotAboveMrp = requiredPrice('Selling price').test(
  'not-above-mrp',
  'Selling price cannot be greater than MRP.',
  function (value) {
    if (value == null) return true
    const mrp = Number(this.parent?.max_price)
    if (!Number.isFinite(mrp) || mrp <= 0) return true
    return value <= mrp
  },
)

const requiredStock = (label: string) =>
  requiredNumber(label).min(0, `${label} cannot be negative`)

const nonNegative = (label: string) =>
  Yup.number().typeError(`${label} must be a number`).min(0, `${label} cannot be negative`)

const optionalBundleLimit = (label: string) =>
  Yup.number()
    .nullable()
    .transform((value, original) => (original === '' || original === null || original === undefined ? null : value))
    .when('product_type', {
      is: 'bundle',
      then: (schema) =>
        schema
          .typeError(`${label} must be a number`)
          .integer(`${label} must be a whole number`)
          .min(1, `${label} must be at least 1`)
          .test(
            'within-selection',
            `${label} cannot be greater than max selection.`,
            function (value) {
              if (value == null) return true
              const selection = Number(this.parent?.max_selection)
              if (!Number.isFinite(selection)) return true
              return value <= selection
            },
          ),
      otherwise: (schema) => schema.nullable(),
    })

const textLimit = (label: string, max: number) =>
  Yup.string().max(max, `${label} must be ${max.toLocaleString()} characters or less.`)

export const addProductValidationSchema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
  slug: Yup.string().trim().required('Slug is required'),
  categoryId: Yup.string().trim().required('Please select a category'),
  short_description: textLimit('Short description', 500),
  description: textLimit('Description', 1000),
  custom_notes: textLimit('Custom notes', 500),
  weight: nonNegative('Weight'),
  max_selection: Yup.number().when('product_type', {
    is: 'bundle',
    then: (schema) =>
      schema
        .typeError('Max selection is required')
        .required('Max selection is required')
        .integer('Max selection must be a whole number')
        .min(1, 'Max selection must be at least 1'),
  }),
  max_product_quantity: optionalBundleLimit('Max single product quantity'),
  variant: Yup.object({
    stock: Yup.number(),
    price: Yup.number(),
    max_price: nonNegative('MRP'),
  })
    .when('product_type', {
      is: 'simple',
      then: (schema) =>
        schema.shape({
          stock: requiredStock('Quantity'),
          price: sellingPriceNotAboveMrp,
          max_price: requiredPrice('MRP'),
        }),
    })
    .when('product_type', {
      is: 'bundle',
      then: (schema) =>
        schema.shape({
          stock: requiredStock('Quantity'),
          price: requiredPrice('Selling price'),
          max_price: nonNegative('MRP'),
        }),
    }),
  variants: Yup.array().when('product_type', {
    is: 'variable',
    then: (schema) =>
      schema
        .min(1, 'Select at least one size.')
        .of(
          Yup.object({
            stock: requiredStock('Stock'),
            price: sellingPriceNotAboveMrp,
            max_price: requiredPrice('MRP'),
            weight: nonNegative('Weight'),
          }),
        ),
  }),
})

const codAmount = (label: string) =>
  Yup.number()
    .transform((value, original) => (original === '' || original == null ? undefined : value))
    .typeError(`${label} must be a number`)
    .min(0, `${label} must be 0 or more`)

const codChargeRequired = (method: 'flat' | 'weight') => (currentMethod: string, isFree: boolean) =>
  currentMethod === method && !isFree

const plainText = (label: string, required: string, max: number) =>
  Yup.string()
    .trim()
    .required(required)
    .max(max, `${label} must be ${max.toLocaleString()} characters or less.`)
    .test('no-script', `${label} cannot include HTML or scripts.`, (value) => !value || !SCRIPT_PATTERN.test(value))

export const faqValidationSchema = Yup.object({
  question: plainText('Question', 'Enter a question.', 100),
  answer: plainText('Answer', 'Enter an answer.', 300),
})

export const addCodMethodValidationSchema = Yup.object({
  countryCode: Yup.string().trim().required('Select a country.'),
  method: Yup.string().oneOf(['flat', 'weight']).required('Select a method.'),
  flatCost: codAmount('Flat cost').when(['method', 'isFree'], {
    is: codChargeRequired('flat'),
    then: (schema) => schema.required('Flat cost is required'),
  }),
  baseCost: codAmount('Base cost').when(['method', 'isFree'], {
    is: codChargeRequired('weight'),
    then: (schema) => schema.required('Base cost is required'),
  }),
  perKg: codAmount('Per kg').when(['method', 'isFree'], {
    is: codChargeRequired('weight'),
    then: (schema) => schema.required('Per kg is required'),
  }),
  stepKg: codAmount('Step kg').when(['method', 'isFree'], {
    is: codChargeRequired('weight'),
    then: (schema) => schema.required('Step kg is required').moreThan(0, 'Step kg must be greater than 0'),
  }),
  skipKg: codAmount('Skip kg'),
  isFree: Yup.boolean(),
  status: Yup.boolean(),
})
