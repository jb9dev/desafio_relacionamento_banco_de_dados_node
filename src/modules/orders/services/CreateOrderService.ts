import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    const findProducts = await this.productsRepository.findAllById(products);
    const order_products = findProducts.map(foundProduct => {
      const { id, quantity } = products.find(
        parsedProduct => parsedProduct.id === foundProduct.id,
      ) as IProduct;

      if (quantity > foundProduct.quantity) {
        throw new AppError("There isn't enough product quantity");
      }

      return {
        product_id: id,
        price: foundProduct.price,
        quantity,
      };
    });

    if (!customer) {
      throw new AppError("This customer doesn't exists");
    }

    if (!findProducts) {
      throw new AppError('No product found with these ids');
    }

    if (products.length !== findProducts.length) {
      throw new AppError(
        'There are some invalid products, please verify the products ids',
      );
    }

    const order = await this.ordersRepository.create({
      customer,
      products: order_products,
    });

    if (order) {
      await this.productsRepository.updateQuantity(products);
    }

    const orderCreated = order;

    delete order.customer_id;

    Object.assign(orderCreated, {
      customer,
      order_products,
    });

    return order;
  }
}

export default CreateOrderService;
