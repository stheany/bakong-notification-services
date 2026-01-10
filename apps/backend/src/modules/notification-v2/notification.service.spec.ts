// import { Test, TestingModule } from '@nestjs/testing'
// import { getRepositoryToken } from '@nestjs/typeorm'
// import { BakongUser } from 'src/entities/bakong-user.entity'
// import { Notification } from 'src/entities/notification.entity'
// import { NotificationServiceV2 } from './notification.v2.service'

// describe('NotificationService', () => {
//   let service: NotificationServiceV2

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [NotificationServiceV2],
//     })
//       .useMocker((token) => {
//         if (token === getRepositoryToken(BakongUser)) {
//           return jest.fn().mockReturnValue(null)
//         }

//         if (token === getRepositoryToken(Notification)) {
//           return jest.fn().mockReturnValue(null)
//         }
//       })
//       .compile()

//     service = module.get<NotificationServiceV2>(NotificationServiceV2)
//   })

//   it('should be defined', () => {
//     expect(service).toBeDefined()
//   })
// })
