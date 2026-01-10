// import { Test, TestingModule } from '@nestjs/testing'
// import { getRepositoryToken } from '@nestjs/typeorm'
// import { BakongUser } from 'src/entities/bakong-user.entity'
// import { NotificationController } from './notification.v2.controller'
// import { NotificationServiceV2 } from './notification.v2.service'

// describe('NotificationController', () => {
//   let controller: NotificationController

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       controllers: [NotificationController],
//     })
//       .useMocker((token) => {
//         if (token === NotificationServiceV2) {
//           return jest.fn().mockReturnValue(null)
//         }
//         if (token === getRepositoryToken(BakongUser)) {
//           return jest.fn().mockReturnValue(null)
//         }
//       })
//       .compile()

//     controller = module.get<NotificationController>(NotificationController)
//   })

//   it('should be defined', () => {
//     expect(controller).toBeDefined()
//   })
// })
