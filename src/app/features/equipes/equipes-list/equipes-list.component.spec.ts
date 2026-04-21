import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EquipesListComponent } from './equipes-list.component';

describe('EquipesListComponent', () => {
  let component: EquipesListComponent;
  let fixture: ComponentFixture<EquipesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EquipesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EquipesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
